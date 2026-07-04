# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Capture document ACL principals from filesystem permissions at ingest time.

On the ANF ``rag-documents`` NFS share, POSIX mode bits and ownership are the
first ACL signal available to the ingestion worker:

- world-readable files map to an empty principal list (unrestricted — every
  authorized role may retrieve the chunk);
- group-readable files that are not world-readable map to
  ``["group:<groupname>"]``;
- owner-only readable files map to ``["user:<username>"]``.

Owner and group names are resolved through the ``pwd`` / ``grp`` databases,
with a numeric-id fallback when the id has no local name (``"user:uid-1000"``,
``"group:gid-123"``) so capture never fails on unmapped NFS ids.

NFSv4 ACLs on ANF are richer than mode bits. ``parse_nfs4_acl`` parses
``nfs4_getfacl`` output lines (``A::user@domain:r...``,
``A:g:group@domain:...``) into principals for ALLOW entries carrying the read
permission. The ``OWNER@`` / ``GROUP@`` / ``EVERYONE@`` specials are ignored,
except an ``EVERYONE@`` ALLOW-read entry, which maps to the unrestricted empty
list. Domain suffixes are dropped (``alice@corp.example.com`` becomes
``user:alice``) because retrieval-side principals use local names.

``capture_acl_principals`` prefers parsed NFSv4 ACL text when the caller
supplies it, and falls back to the ``os.stat`` mode-bit mapping otherwise.

Everything here is a pure function over supplied text or a stat call — no
subprocess invocations. The caller runs ``nfs4_getfacl`` (or not) and passes
the output in, which keeps this module unit-testable on any filesystem.
"""

from __future__ import annotations

import grp
import os
import pwd
import stat
from typing import Iterator

# nfs4_getfacl ACE fields: type:flags:principal:permissions
_ACE_ALLOW = "A"
_ACE_GROUP_FLAG = "g"
_ACE_READ_PERMISSION = "r"
_SPECIAL_PRINCIPALS = ("OWNER@", "GROUP@", "EVERYONE@")


def _iter_aces(text: str) -> Iterator[tuple[str, str, str, str]]:
    """Yield (type, flags, principal, permissions) for each parseable ACE line."""
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        fields = line.split(":", 3)
        if len(fields) != 4:
            continue
        yield (fields[0], fields[1], fields[2], fields[3])


def _local_name(principal: str) -> str:
    """Drop the NFSv4 idmap domain suffix: alice@corp.example.com -> alice."""
    return principal.split("@", 1)[0]


def _user_principal_from_name(name: str) -> str:
    if name.isdigit():
        return f"user:uid-{name}"
    return f"user:{name}"


def _group_principal_from_name(name: str) -> str:
    if name.isdigit():
        return f"group:gid-{name}"
    return f"group:{name}"


def parse_nfs4_acl(text: str) -> list[str]:
    """Map nfs4_getfacl output to retrieval ACL principals.

    Only ALLOW entries carrying the read permission contribute. OWNER@ and
    GROUP@ specials are ignored; an EVERYONE@ ALLOW-read entry short-circuits
    to the unrestricted empty list. Numeric principals (unmapped ids) fall
    back to "user:uid-<n>" / "group:gid-<n>".
    """
    principals: list[str] = []
    seen: set[str] = set()
    for ace_type, flags, principal, permissions in _iter_aces(text):
        if ace_type != _ACE_ALLOW:
            continue
        if _ACE_READ_PERMISSION not in permissions:
            continue
        if principal == "EVERYONE@":
            # World-readable via NFSv4 ACL: unrestricted.
            return []
        if principal in _SPECIAL_PRINCIPALS:
            continue
        name = _local_name(principal)
        if not name:
            continue
        if _ACE_GROUP_FLAG in flags:
            mapped = _group_principal_from_name(name)
        else:
            mapped = _user_principal_from_name(name)
        if mapped not in seen:
            seen.add(mapped)
            principals.append(mapped)
    return principals


def _owner_principal(uid: int) -> str:
    try:
        return f"user:{pwd.getpwuid(uid).pw_name}"
    except KeyError:
        return f"user:uid-{uid}"


def _group_principal(gid: int) -> str:
    try:
        return f"group:{grp.getgrgid(gid).gr_name}"
    except KeyError:
        return f"group:gid-{gid}"


def _principals_from_mode_bits(path: str) -> list[str]:
    """Map POSIX mode bits and ownership to retrieval ACL principals."""
    stat_result = os.stat(path)
    mode = stat_result.st_mode
    if mode & stat.S_IROTH:
        # World-readable: unrestricted.
        return []
    if mode & stat.S_IRGRP:
        return [_group_principal(stat_result.st_gid)]
    return [_owner_principal(stat_result.st_uid)]


def capture_acl_principals(path: str, nfs4_acl_text: str | None = None) -> list[str]:
    """Capture ACL principals for a source file.

    Prefers NFSv4 ACL text (nfs4_getfacl output supplied by the caller) when
    it contains at least one parseable ACE; otherwise falls back to the POSIX
    mode-bit mapping from os.stat.
    """
    if nfs4_acl_text is not None:
        if any(True for _ in _iter_aces(nfs4_acl_text)):
            return parse_nfs4_acl(nfs4_acl_text)
    return _principals_from_mode_bits(path)


if __name__ == "__main__":
    import sys
    import tempfile

    failures: list[str] = []

    def _check(condition: bool, label: str) -> None:
        if not condition:
            failures.append(label)

    everyone_acl = "\n".join(
        [
            "# file: /mnt/documents/handbook.pdf",
            "A::OWNER@:rwatTnNcy",
            "A:g:GROUP@:rtncy",
            "A::EVERYONE@:rtncy",
        ]
    )
    _check(
        parse_nfs4_acl(everyone_acl) == [],
        "EVERYONE@ ALLOW-read maps to unrestricted",
    )

    restricted_acl = "\n".join(
        [
            "# file: /mnt/documents/policy.pdf",
            "A::alice@corp.example.com:rxtncy",
            "A:g:engineering@corp.example.com:rtncy",
            "A:g:12345@corp.example.com:rtncy",
            "A::1000@corp.example.com:rtncy",
            "D::mallory@corp.example.com:rwa",
            "A::OWNER@:rwatTnNcy",
            "A:g:GROUP@:rtncy",
            "A::bob@corp.example.com:waTC",
            "A::alice@corp.example.com:rtncy",
        ]
    )
    _check(
        parse_nfs4_acl(restricted_acl)
        == [
            "user:alice",
            "group:engineering",
            "group:gid-12345",
            "user:uid-1000",
        ],
        "restricted ACL maps ALLOW-read users/groups with numeric-id fallback",
    )

    _check(
        parse_nfs4_acl("A::EVERYONE@:waTC\nA::carol@corp:rtncy") == ["user:carol"],
        "EVERYONE@ without read does not grant unrestricted",
    )
    _check(parse_nfs4_acl("not an acl\n\n# comment") == [], "garbage text yields no principals")

    with tempfile.NamedTemporaryFile(delete=False) as handle:
        temp_path = handle.name
    try:
        os.chmod(temp_path, 0o644)
        _check(
            capture_acl_principals(temp_path) == [],
            "mode 0644 (world-readable) maps to unrestricted",
        )

        os.chmod(temp_path, 0o640)
        group_only = capture_acl_principals(temp_path)
        _check(
            len(group_only) == 1 and group_only[0].startswith("group:"),
            "mode 0640 (group-readable) maps to one group principal",
        )

        os.chmod(temp_path, 0o600)
        owner_only = capture_acl_principals(temp_path)
        _check(
            len(owner_only) == 1 and owner_only[0].startswith("user:"),
            "mode 0600 (owner-only) maps to one user principal",
        )

        _check(
            capture_acl_principals(temp_path, nfs4_acl_text=everyone_acl) == [],
            "supplied NFSv4 ACL text is preferred over mode bits",
        )
        _check(
            capture_acl_principals(temp_path, nfs4_acl_text="not an acl") == owner_only,
            "unparseable NFSv4 text falls back to mode bits",
        )
    finally:
        os.unlink(temp_path)

    if failures:
        for failure in failures:
            print(f"SELF-TEST FAIL: {failure}", file=sys.stderr)
        sys.exit(1)
    print("SELF-TEST PASS")

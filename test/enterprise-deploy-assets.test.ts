// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml, parseAllDocuments } from "yaml";

const repoRoot = path.resolve(import.meta.dirname, "..");
const deployRoot = path.join(repoRoot, "enterprise", "deploy");

const requiredK8sManifests = [
  "k8s/00-namespaces.yaml",
  "k8s/10-storageclasses-anf.yaml",
  "k8s/20-postgresql-pgvector.yaml",
  "k8s/30-nim-rag-services.yaml",
  "k8s/31-nemotron-nimservice.yaml",
  "k8s/32-gemma-vllm.yaml",
  "k8s/33-gemma-sglang.yaml",
  "k8s/40-nv-ingest-pipeline.yaml",
  "k8s/50-retrieval-api.yaml",
  "k8s/60-console.yaml",
  "k8s/70-nemoclaw-worker-tier.yaml",
];

const requiredBicepFiles = [
  "azure/main.bicep",
  "azure/modules/network.bicep",
  "azure/modules/anf.bicep",
  "azure/modules/aks.bicep",
  "azure/modules/keyvault.bicep",
];

const requiredScripts = [
  "scripts/01-deploy-infra.sh",
  "scripts/02-bootstrap-cluster.sh",
  "scripts/03-deploy-stack.sh",
  "scripts/04-validate-e2e.sh",
];

function deployPath(relativePath: string) {
  return path.join(deployRoot, relativePath);
}

function read(relativePath: string) {
  return fs.readFileSync(deployPath(relativePath), "utf8");
}

function exists(relativePath: string) {
  return fs.existsSync(deployPath(relativePath));
}

// Parse a manifest that may be a single document, a kind: List, or a
// ----separated multi-document stream, and return the flattened resources.
function parseManifestResources(relativePath: string) {
  const documents = parseAllDocuments(read(relativePath));
  const resources: Record<string, unknown>[] = [];
  for (const document of documents) {
    expect(document.errors).toEqual([]);
    const value = document.toJS() as Record<string, unknown> | null;
    if (!value) {
      continue;
    }
    if (value.kind === "List" && Array.isArray(value.items)) {
      resources.push(...(value.items as Record<string, unknown>[]));
    } else {
      resources.push(value);
    }
  }
  return resources;
}

describe("enterprise deploy assets (NemoMaxxing)", () => {
  it("ships the deployment README with the layer model and honest validation status", () => {
    expect(exists("README.md")).toBe(true);
    const readme = read("README.md");
    expect(readme).toContain("NemoMaxxing");
    expect(readme).toContain("Azure NetApp Files");
    expect(readme).toMatch(/not.*validated/i);
  });

  it("includes every numbered k8s manifest and keeps them parseable", () => {
    for (const relativePath of requiredK8sManifests) {
      expect(exists(relativePath)).toBe(true);
      const resources = parseManifestResources(relativePath);
      expect(resources.length).toBeGreaterThan(0);
      for (const resource of resources) {
        expect(typeof resource.kind).toBe("string");
        expect(typeof resource.apiVersion).toBe("string");
      }
    }
  });

  it("provisions the ANF storage classes through Trident with hard NFSv4.1 mounts", () => {
    const resources = parseManifestResources("k8s/10-storageclasses-anf.yaml");
    const names = resources.map(
      (resource) => (resource.metadata as { name: string }).name,
    );
    expect(names).toEqual(
      expect.arrayContaining(["anf-ultra-rwx", "anf-premium-rwx", "anf-standard-rwx"]),
    );
    for (const resource of resources) {
      expect(resource.provisioner).toBe("csi.trident.netapp.io");
      expect(resource.mountOptions).toEqual(
        expect.arrayContaining(["nfsvers=4.1", "hard"]),
      );
    }
  });

  it("splits PostgreSQL WAL and data onto different ANF service levels", () => {
    const resources = parseManifestResources("k8s/20-postgresql-pgvector.yaml");
    const statefulSet = resources.find((resource) => resource.kind === "StatefulSet") as {
      spec: {
        volumeClaimTemplates: {
          metadata: { name: string };
          spec: { storageClassName: string };
        }[];
      };
    };
    expect(statefulSet).toBeDefined();
    const claims = Object.fromEntries(
      statefulSet.spec.volumeClaimTemplates.map((template) => [
        template.metadata.name,
        template.spec.storageClassName,
      ]),
    );
    expect(claims["pg-wal"]).toBe("anf-ultra-rwx");
    expect(claims["pg-data"]).toBe("anf-premium-rwx");
  });

  it("keeps the console env contract stable for the parallel console build", () => {
    const resources = parseManifestResources("k8s/60-console.yaml");
    const deployment = resources.find((resource) => resource.kind === "Deployment") as {
      spec: {
        template: {
          spec: { containers: { env: { name: string; value?: string }[] }[] };
        };
      };
    };
    expect(deployment).toBeDefined();
    const env = Object.fromEntries(
      deployment.spec.template.spec.containers[0].env.map((entry) => [
        entry.name,
        entry.value,
      ]),
    );
    expect(env.RETRIEVAL_API_URL).toBe(
      "http://retrieval-gateway.data-plane.svc.cluster.local:8095",
    );
    expect(env.CHAT_ENDPOINT).toBe("http://nemotron-llm.inference.svc.cluster.local:8000");
    expect(env.CHAT_MODEL).toBe("nvidia/llama-3.1-nemotron-ultra-253b-v1");
  });

  it("wires the retrieval API to the documented env contract", () => {
    const manifest = read("k8s/50-retrieval-api.yaml");
    expect(manifest).toContain("RETRIEVAL_API_BACKEND");
    expect(manifest).toContain("RETRIEVAL_API_DATABASE_URL");
    expect(manifest).toContain("EMBEDDING_ENDPOINT");
    expect(manifest).toContain("RERANK_ENDPOINT");
    const resources = parseManifestResources("k8s/50-retrieval-api.yaml");
    const jobNames = resources
      .filter((resource) => resource.kind === "Job")
      .map((resource) => (resource.metadata as { name: string }).name);
    expect(jobNames).toEqual(
      expect.arrayContaining(["retrieval-bootstrap", "retrieval-postgres-verify"]),
    );
  });

  it("gates the retrieval API behind the secure gateway", () => {
    const manifest = read("k8s/55-gateway.yaml");
    expect(manifest).toContain("retrieval-gateway");
    expect(manifest).toContain("GATEWAY_AUTH_MODE");
    expect(manifest).toContain("gateway-static-tokens");
    expect(manifest).toContain("kind: NetworkPolicy");
    expect(manifest).toContain("retrieval-api-only-from-gateway");

    const consoleManifest = read("k8s/60-console.yaml");
    expect(consoleManifest).toContain("CONSOLE_RETRIEVAL_TOKEN");
    expect(consoleManifest).toContain("retrieval-gateway.data-plane.svc.cluster.local:8095");

    const deployScript = read("scripts/03-deploy-stack.sh");
    expect(deployScript).toContain("55-gateway.yaml");
  });

  it("provisions the forward-looking KV-cache tier", () => {
    const docs = parseManifestResources("k8s/34-dynamo-kv-cache.yaml");
    const manifest = read("k8s/34-dynamo-kv-cache.yaml");
    expect(docs.length).toBeGreaterThan(0);
    expect(manifest).toContain("anf-ultra-rwx");
    expect(manifest).toContain("ReadWriteMany");
    expect(manifest).toContain("/kv-cache");
    expect(manifest).toContain("assumed");

    const bicep = read("azure/modules/anf.bicep");
    expect(bicep).toContain("kv-cache");
    expect(bicep).toContain("kvCacheSizeGib");
  });

  it("includes the Bicep tree with the key Azure resource types", () => {
    for (const relativePath of requiredBicepFiles) {
      expect(exists(relativePath)).toBe(true);
    }
    expect(read("azure/modules/anf.bicep")).toContain("Microsoft.NetApp/netAppAccounts");
    expect(read("azure/modules/aks.bicep")).toContain(
      "Microsoft.ContainerService/managedClusters",
    );
    const network = read("azure/modules/network.bicep");
    expect(network).toContain("delegations");
    expect(network).toContain("Microsoft.NetApp/volumes");
    const main = read("azure/main.bicep");
    for (const moduleName of ["network", "anf", "aks", "keyvault"]) {
      expect(main).toContain(`modules/${moduleName}.bicep`);
    }
  });

  it("ships executable, strict-mode deployment scripts", () => {
    for (const relativePath of requiredScripts) {
      expect(exists(relativePath)).toBe(true);
      const stat = fs.statSync(deployPath(relativePath));
      expect(stat.mode & 0o111, `${relativePath} must be executable`).not.toBe(0);
      const contents = read(relativePath);
      expect(contents.startsWith("#!/usr/bin/env bash")).toBe(true);
      expect(contents).toContain("set -euo pipefail");
    }
  });

  it("keeps the YAML library contract used by the incubator test", () => {
    // Single-document parse must also work for kind: List manifests, matching
    // test/enterprise-azure-anf-incubator.test.ts.
    for (const relativePath of requiredK8sManifests) {
      expect(() => parseYaml(read(relativePath))).not.toThrow();
    }
  });
});

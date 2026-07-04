// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// NemoMaxxing ANF storage layer: NetApp account, three capacity pools
// (ultra / premium / standard), and the five platform volumes from
// incubator/enterprise-azure-anf/specs/08-anf-storage-layout-and-dr.md:
//   models-cache   (premium)  - NIM model weights, RWX across NIM pods
//   pg-wal         (ultra)    - PostgreSQL write-ahead log
//   pg-data        (premium)  - PostgreSQL data
//   rag-documents  (standard) - RAG source document share (NFS; see SMB note below)
//   agent-workspace (premium) - NemoClaw worker-tier persistent agent state
//
// Trident (k8s/10-storageclasses-anf.yaml) dynamically provisions additional
// volumes in these same pools via serviceLevel selectors; the volumes here are
// the statically defined platform shares.

@description('Azure region. ANF must have regional capacity here; verify with az netappfiles check-quota-availability.')
param location string

@description('Resource name prefix, e.g. nemomaxxing.')
param prefix string

@description('Resource ID of the subnet delegated to Microsoft.NetApp/volumes.')
param anfDelegatedSubnetId string

@description('Ultra capacity pool size in TiB. ANF pool minimum is 1 TiB (large-pool features may require more; operator must verify current minimums).')
@minValue(1)
param ultraPoolSizeTiB int = 4

@description('Premium capacity pool size in TiB.')
@minValue(1)
param premiumPoolSizeTiB int = 8

@description('Standard capacity pool size in TiB.')
@minValue(1)
param standardPoolSizeTiB int = 4

// Size of the forward-looking KV-cache volume on the ultra pool (GiB).
param kvCacheSizeGib int = 4096

// NFS protocol for all platform volumes. NFSv4.1 is the platform default;
// NFSv3 is acceptable for the read-mostly models-cache if v4.1 locking
// overhead shows up in benchmarks (spec 10).
var nfsProtocol = 'NFSv4.1'

var tib = 1099511627776
var gib = 1073741824

var defaultExportPolicy = {
  rules: [
    {
      ruleIndex: 1
      unixReadOnly: false
      unixReadWrite: true
      nfsv3: false
      nfsv41: true
      // Operator must verify: restrict to the AKS nodes subnet CIDR in production.
      allowedClients: '0.0.0.0/0'
      hasRootAccess: true
    }
  ]
}

resource netAppAccount 'Microsoft.NetApp/netAppAccounts@2024-03-01' = {
  name: '${prefix}-anf'
  location: location
}

resource ultraPool 'Microsoft.NetApp/netAppAccounts/capacityPools@2024-03-01' = {
  parent: netAppAccount
  name: '${prefix}-pool-ultra'
  location: location
  properties: {
    serviceLevel: 'Ultra'
    size: ultraPoolSizeTiB * tib
    qosType: 'Auto'
  }
}

resource premiumPool 'Microsoft.NetApp/netAppAccounts/capacityPools@2024-03-01' = {
  parent: netAppAccount
  name: '${prefix}-pool-premium'
  location: location
  properties: {
    serviceLevel: 'Premium'
    size: premiumPoolSizeTiB * tib
    qosType: 'Auto'
  }
}

resource standardPool 'Microsoft.NetApp/netAppAccounts/capacityPools@2024-03-01' = {
  parent: netAppAccount
  name: '${prefix}-pool-standard'
  location: location
  properties: {
    serviceLevel: 'Standard'
    size: standardPoolSizeTiB * tib
    qosType: 'Auto'
    // Cool access auto-tiering for the document repository tier is enabled at
    // the volume level once GA behavior is confirmed for this region.
  }
}

// --- Volumes -----------------------------------------------------------------

resource modelsCacheVolume 'Microsoft.NetApp/netAppAccounts/capacityPools/volumes@2024-03-01' = {
  parent: premiumPool
  name: 'models-cache'
  location: location
  properties: {
    creationToken: '${prefix}-models-cache'
    // Large volume: NIM caches for embedder + reranker + Nemotron Ultra 253B
    // TRT-LLM engines. 4 TiB minimum; resize upward before adding models.
    usageThreshold: 4 * tib
    protocolTypes: [
      nfsProtocol
    ]
    subnetId: anfDelegatedSubnetId
    exportPolicy: defaultExportPolicy
  }
}

resource pgWalVolume 'Microsoft.NetApp/netAppAccounts/capacityPools/volumes@2024-03-01' = {
  parent: ultraPool
  name: 'pg-wal'
  location: location
  properties: {
    creationToken: '${prefix}-pg-wal'
    usageThreshold: 1 * tib
    protocolTypes: [
      nfsProtocol
    ]
    subnetId: anfDelegatedSubnetId
    exportPolicy: defaultExportPolicy
  }
}

resource pgDataVolume 'Microsoft.NetApp/netAppAccounts/capacityPools/volumes@2024-03-01' = {
  parent: premiumPool
  name: 'pg-data'
  location: location
  properties: {
    creationToken: '${prefix}-pg-data'
    usageThreshold: 4 * tib
    protocolTypes: [
      nfsProtocol
    ]
    subnetId: anfDelegatedSubnetId
    exportPolicy: defaultExportPolicy
  }
}

resource ragDocumentsVolume 'Microsoft.NetApp/netAppAccounts/capacityPools/volumes@2024-03-01' = {
  parent: standardPool
  name: 'rag-documents'
  location: location
  properties: {
    creationToken: '${prefix}-rag-documents'
    usageThreshold: 2 * tib
    // RAG source file share. NFS for the in-cluster ingest pipeline.
    // Optional SMB: ANF supports dual-protocol (NFSv4.1 + SMB) volumes for
    // office-side document drops, but dual-protocol requires Active Directory
    // configuration on the NetApp account — operator must verify AD wiring
    // before switching protocolTypes to ['NFSv4.1', 'CIFS'].
    protocolTypes: [
      nfsProtocol
    ]
    subnetId: anfDelegatedSubnetId
    exportPolicy: defaultExportPolicy
  }
}

resource agentWorkspaceVolume 'Microsoft.NetApp/netAppAccounts/capacityPools/volumes@2024-03-01' = {
  parent: premiumPool
  name: 'agent-workspace'
  location: location
  properties: {
    creationToken: '${prefix}-agent-workspace'
    usageThreshold: 1 * tib
    protocolTypes: [
      nfsProtocol
    ]
    subnetId: anfDelegatedSubnetId
    exportPolicy: defaultExportPolicy
  }
}

// Forward-looking KV-cache tier (status: assumed). Dynamo/NIXL and the ICMSP
// reference standardize KV-cache offload to networked storage, and NetApp's
// AI Data Engine aligns the ONTAP family with that pattern. Provisioned on
// the ultra pool so a Dynamo-served NIM can be benchmarked against it; not
// validated until that GPU-cluster run happens.
resource kvCacheVolume 'Microsoft.NetApp/netAppAccounts/capacityPools/volumes@2024-03-01' = {
  parent: ultraPool
  name: 'kv-cache'
  location: location
  properties: {
    creationToken: '${prefix}-kv-cache'
    usageThreshold: kvCacheSizeGib * gib
    protocolTypes: [
      nfsProtocol
    ]
    subnetId: anfDelegatedSubnetId
    exportPolicy: defaultExportPolicy
  }
}

// --- Outputs -----------------------------------------------------------------

output netAppAccountId string = netAppAccount.id
output netAppAccountName string = netAppAccount.name
output ultraPoolName string = ultraPool.name
output premiumPoolName string = premiumPool.name
output standardPoolName string = standardPool.name

output modelsCacheVolumeId string = modelsCacheVolume.id
output pgWalVolumeId string = pgWalVolume.id
output pgDataVolumeId string = pgDataVolume.id
output ragDocumentsVolumeId string = ragDocumentsVolume.id
output agentWorkspaceVolumeId string = agentWorkspaceVolume.id
output kvCacheVolumeId string = kvCacheVolume.id

// Mount target IPs for static PV definitions and NFS clients.
output modelsCacheMountIp string = modelsCacheVolume.properties.mountTargets[0].ipAddress
output pgWalMountIp string = pgWalVolume.properties.mountTargets[0].ipAddress
output pgDataMountIp string = pgDataVolume.properties.mountTargets[0].ipAddress
output ragDocumentsMountIp string = ragDocumentsVolume.properties.mountTargets[0].ipAddress
output agentWorkspaceMountIp string = agentWorkspaceVolume.properties.mountTargets[0].ipAddress
output kvCacheMountIp string = kvCacheVolume.properties.mountTargets[0].ipAddress

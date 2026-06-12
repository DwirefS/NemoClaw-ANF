// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// NemoMaxxing infrastructure entry point.
// Subscription-scoped: creates the resource group, then composes the
// network, ANF storage, AKS, and Key Vault modules.
//
// Deploy via scripts/01-deploy-infra.sh:
//   az deployment sub create --location <location> --template-file main.bicep ...
//
// NOT YET VALIDATED against a real Azure subscription; compile with
// `az bicep build --file main.bicep` before first use.

targetScope = 'subscription'

@description('Azure region for all resources. Must have ANF capacity and GPU quota.')
param location string = 'eastus2'

@description('Resource name prefix applied to every resource.')
@minLength(3)
@maxLength(15)
param prefix string = 'nemomaxxing'

@description('VNet address space CIDR.')
param vnetCidr string = '10.60.0.0/16'

@description('ANF Ultra capacity pool size in TiB (pg-wal).')
param anfUltraPoolSizeTiB int = 4

@description('ANF Premium capacity pool size in TiB (models-cache, pg-data, agent-workspace).')
param anfPremiumPoolSizeTiB int = 8

@description('ANF Standard capacity pool size in TiB (rag-documents).')
param anfStandardPoolSizeTiB int = 4

@description('GPU VM size for the AKS gpu pool. See aks.bicep for SKU guidance.')
param gpuVmSize string = 'Standard_NC24ads_A100_v4'

@description('GPU node count.')
param gpuNodeCount int = 2

@description('System pool node count.')
param systemNodeCount int = 3

@description('NemoClaw worker-tier CPU pool node count.')
param cpuWorkerNodeCount int = 2

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${prefix}'
  location: location
}

module network 'modules/network.bicep' = {
  name: '${prefix}-network'
  scope: resourceGroup
  params: {
    location: location
    prefix: prefix
    vnetCidr: vnetCidr
  }
}

module anf 'modules/anf.bicep' = {
  name: '${prefix}-anf'
  scope: resourceGroup
  params: {
    location: location
    prefix: prefix
    anfDelegatedSubnetId: network.outputs.anfDelegatedSubnetId
    ultraPoolSizeTiB: anfUltraPoolSizeTiB
    premiumPoolSizeTiB: anfPremiumPoolSizeTiB
    standardPoolSizeTiB: anfStandardPoolSizeTiB
  }
}

module aks 'modules/aks.bicep' = {
  name: '${prefix}-aks'
  scope: resourceGroup
  params: {
    location: location
    prefix: prefix
    aksNodesSubnetId: network.outputs.aksNodesSubnetId
    gpuVmSize: gpuVmSize
    gpuNodeCount: gpuNodeCount
    systemNodeCount: systemNodeCount
    cpuWorkerNodeCount: cpuWorkerNodeCount
  }
}

module keyvault 'modules/keyvault.bicep' = {
  name: '${prefix}-keyvault'
  scope: resourceGroup
  params: {
    location: location
    prefix: prefix
    aksOidcIssuerUrl: aks.outputs.oidcIssuerUrl
  }
}

output resourceGroupName string = resourceGroup.name
output aksName string = aks.outputs.aksName
output aksOidcIssuerUrl string = aks.outputs.oidcIssuerUrl
output netAppAccountName string = anf.outputs.netAppAccountName
output modelsCacheVolumeId string = anf.outputs.modelsCacheVolumeId
output pgWalVolumeId string = anf.outputs.pgWalVolumeId
output pgDataVolumeId string = anf.outputs.pgDataVolumeId
output ragDocumentsVolumeId string = anf.outputs.ragDocumentsVolumeId
output agentWorkspaceVolumeId string = anf.outputs.agentWorkspaceVolumeId
output keyVaultName string = keyvault.outputs.keyVaultName
output retrievalApiIdentityClientId string = keyvault.outputs.retrievalApiIdentityClientId

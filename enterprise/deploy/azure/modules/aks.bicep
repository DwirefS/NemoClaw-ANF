// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// NemoMaxxing AKS cluster:
// - OIDC issuer + workload identity enabled (Key Vault access for the
//   retrieval API service account, see keyvault.bicep)
// - system CPU pool for cluster services
// - gpu pool for NIM / vLLM / SGLang workloads, tainted nvidia.com/gpu=present:NoSchedule
// - cpu-worker pool for the NemoClaw worker tier

@description('Azure region.')
param location string

@description('Resource name prefix, e.g. nemomaxxing.')
param prefix string

@description('Resource ID of the aks-nodes subnet.')
param aksNodesSubnetId string

@description('Kubernetes version. Operator must verify availability with az aks get-versions.')
param kubernetesVersion string = '1.30'

@description('VM size for the system pool.')
param systemVmSize string = 'Standard_D8s_v5'

@description('Node count for the system pool.')
@minValue(1)
param systemNodeCount int = 3

@description('GPU VM size. Default is a single-A100 SKU; the Nemotron Ultra 253B profile in k8s/31 needs a multi-GPU SKU (e.g. Standard_ND96isr_H100_v5). Operator must verify regional quota.')
param gpuVmSize string = 'Standard_NC24ads_A100_v4'

@description('Node count for the GPU pool.')
@minValue(0)
param gpuNodeCount int = 2

@description('VM size for the NemoClaw worker-tier CPU pool.')
param cpuWorkerVmSize string = 'Standard_D16s_v5'

@description('Node count for the NemoClaw worker-tier CPU pool.')
@minValue(0)
param cpuWorkerNodeCount int = 2

resource aks 'Microsoft.ContainerService/managedClusters@2024-05-01' = {
  name: '${prefix}-aks'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    kubernetesVersion: kubernetesVersion
    dnsPrefix: '${prefix}-aks'
    oidcIssuerProfile: {
      enabled: true
    }
    securityProfile: {
      workloadIdentity: {
        enabled: true
      }
    }
    networkProfile: {
      networkPlugin: 'azure'
      networkPluginMode: 'overlay'
      networkPolicy: 'cilium'
      networkDataplane: 'cilium'
    }
    agentPoolProfiles: [
      {
        name: 'system'
        mode: 'System'
        count: systemNodeCount
        vmSize: systemVmSize
        osType: 'Linux'
        osSKU: 'AzureLinux'
        vnetSubnetID: aksNodesSubnetId
      }
      {
        name: 'gpu'
        mode: 'User'
        count: gpuNodeCount
        vmSize: gpuVmSize
        osType: 'Linux'
        osSKU: 'Ubuntu'
        vnetSubnetID: aksNodesSubnetId
        nodeTaints: [
          'nvidia.com/gpu=present:NoSchedule'
        ]
        nodeLabels: {
          'nvidia.com/gpu.present': 'true'
          'nemomaxxing.nvidia.com/pool': 'gpu'
        }
        // GPU Operator (installed by scripts/02-bootstrap-cluster.sh) manages
        // the driver stack; keep the AKS-managed GPU driver install disabled.
        gpuProfile: {
          driver: 'None'
        }
      }
      {
        name: 'cpuworker'
        mode: 'User'
        count: cpuWorkerNodeCount
        vmSize: cpuWorkerVmSize
        osType: 'Linux'
        osSKU: 'AzureLinux'
        vnetSubnetID: aksNodesSubnetId
        nodeLabels: {
          'nemomaxxing.nvidia.com/pool': 'cpu-worker'
        }
      }
    ]
  }
}

output aksId string = aks.id
output aksName string = aks.name
output oidcIssuerUrl string = aks.properties.oidcIssuerProfile.issuerURL
output kubeletIdentityObjectId string = aks.properties.identityProfile.kubeletidentity.objectId

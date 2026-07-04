// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// NemoMaxxing network layer: one VNet, three subnets.
// - aks-nodes:         AKS node pools (system, gpu, cpu-worker)
// - anf-delegated:     delegated to Microsoft.NetApp/volumes (ANF mount targets)
// - private-endpoints: Key Vault / ACR / other private endpoints

@description('Azure region for all network resources.')
param location string

@description('Resource name prefix, e.g. nemomaxxing.')
param prefix string

@description('VNet address space CIDR.')
param vnetCidr string = '10.60.0.0/16'

@description('Subnet CIDR for AKS nodes. Must fit the node + pod count for the chosen network plugin.')
param aksNodesSubnetCidr string = '10.60.0.0/20'

@description('Subnet CIDR for the ANF delegated subnet. /24 is the ANF-recommended minimum sizing.')
param anfDelegatedSubnetCidr string = '10.60.16.0/24'

@description('Subnet CIDR for private endpoints.')
param privateEndpointsSubnetCidr string = '10.60.17.0/24'

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: '${prefix}-vnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        vnetCidr
      ]
    }
    subnets: [
      {
        name: 'aks-nodes'
        properties: {
          addressPrefix: aksNodesSubnetCidr
        }
      }
      {
        name: 'anf-delegated'
        properties: {
          addressPrefix: anfDelegatedSubnetCidr
          delegations: [
            {
              name: 'netapp-volumes'
              properties: {
                serviceName: 'Microsoft.NetApp/volumes'
              }
            }
          ]
        }
      }
      {
        name: 'private-endpoints'
        properties: {
          addressPrefix: privateEndpointsSubnetCidr
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

output vnetId string = vnet.id
output vnetName string = vnet.name
output aksNodesSubnetId string = vnet.properties.subnets[0].id
output anfDelegatedSubnetId string = vnet.properties.subnets[1].id
output privateEndpointsSubnetId string = vnet.properties.subnets[2].id

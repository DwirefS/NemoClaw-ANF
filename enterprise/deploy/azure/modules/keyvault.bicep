// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// NemoMaxxing secrets layer: Key Vault + user-assigned managed identity +
// federated credential for the retrieval API service account (AKS Workload
// Identity pattern, paired with the SecretProviderClass in the incubator
// private-connectivity manifest).

@description('Azure region.')
param location string

@description('Resource name prefix, e.g. nemomaxxing.')
param prefix string

@description('OIDC issuer URL from the AKS cluster (aks.bicep output oidcIssuerUrl).')
param aksOidcIssuerUrl string

@description('Kubernetes namespace of the retrieval API service account.')
param retrievalApiNamespace string = 'data-plane'

@description('Kubernetes service account name for the retrieval API.')
param retrievalApiServiceAccount string = 'retrieval-api'

@description('Azure AD tenant ID for Key Vault and the federated credential.')
param tenantId string = subscription().tenantId

resource retrievalApiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-retrieval-api-identity'
  location: location
}

// Federated credential binding the Kubernetes service account to the managed
// identity. Placeholder until the cluster exists: the subject must match the
// service account created in k8s/50-retrieval-api.yaml, and the pods must carry
// the azure.workload.identity/use: "true" label for the token to be projected.
resource retrievalApiFederatedCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: retrievalApiIdentity
  name: 'retrieval-api-workload-identity'
  properties: {
    issuer: aksOidcIssuerUrl
    subject: 'system:serviceaccount:${retrievalApiNamespace}:${retrievalApiServiceAccount}'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${prefix}-kv'
  location: location
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    // Operator must verify: in production, set publicNetworkAccess to
    // 'Disabled' and reach the vault through a private endpoint in the
    // private-endpoints subnet (network.bicep).
    publicNetworkAccess: 'Enabled'
  }
}

// Key Vault Secrets User role for the retrieval API identity.
// Role definition ID 4633458b-17de-408a-b874-0445c86b69e6 is the built-in
// "Key Vault Secrets User" role.
resource secretsUserRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, retrievalApiIdentity.id, 'kv-secrets-user')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6'
    )
    principalId: retrievalApiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output retrievalApiIdentityId string = retrievalApiIdentity.id
output retrievalApiIdentityClientId string = retrievalApiIdentity.properties.clientId
output retrievalApiIdentityPrincipalId string = retrievalApiIdentity.properties.principalId

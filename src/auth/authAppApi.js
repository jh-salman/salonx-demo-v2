import { apiJson } from '../lib/http.js'

export const authAppApi = {
  me: () => apiJson('/api/auth-app/me'),
  onboard: (body) =>
    apiJson('/api/auth-app/onboard', { method: 'POST', body: body || {} }),
  createOrganization: (body) =>
    apiJson('/api/auth-app/organizations', { method: 'POST', body: body || {} }),
  switchOrganization: (organizationId) =>
    apiJson('/api/auth-app/switch-organization', {
      method: 'POST',
      body: { organizationId },
    }),
  acceptInvite: (invitationId) =>
    apiJson('/api/auth-app/accept-invite', {
      method: 'POST',
      body: { invitationId },
    }),
  orgInvitations: () => apiJson('/api/auth-app/org-invitations'),
  orgMembers: () => apiJson('/api/auth-app/org-members'),
  removeMember: (memberId) =>
    apiJson('/api/auth-app/remove-member', {
      method: 'POST',
      body: { memberId },
    }),
  deleteInvitation: (invitationId) =>
    apiJson('/api/auth-app/delete-invitation', {
      method: 'POST',
      body: { invitationId },
    }),
}

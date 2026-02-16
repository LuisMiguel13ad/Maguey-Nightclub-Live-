describe('Smoke Test', () => {
  it('loads pass-lounge homepage', () => {
    cy.visit('/');
    cy.get('body').should('be.visible');
  });

  it('can access health check task', () => {
    cy.task('healthCheck').then((checks) => {
      expect(checks).to.have.property('db');
      expect(checks).to.have.property('stripe');
      expect(checks).to.have.property('edgeFunctions');
    });
  });
});

export const queryFixtures = [
    {
        name: 'Checkout Session',
        query: 'create stripe checkout session',
        relevant: ['sha-checkout-service'],
        vector: [0.99, 0.1, 0.05, 0.02]
    },
    {
        name: 'Cart Totals',
        query: 'synchronize cart totals',
        relevant: ['sha-cart-service'],
        vector: [0.97, 0.14, 0.05, 0.02]
    },
    {
        name: 'Password Reset',
        query: 'send password reset email',
        relevant: ['sha-auth-email'],
        vector: [0.14, 0.24, 0.93, 0.08]
    },
    {
        name: 'Invoice PDF',
        query: 'render invoice pdf',
        relevant: ['sha-invoice-pdf'],
        vector: [0.18, 0.26, 0.12, 0.95]
    }
];

export function getQueryVector(query) {
    const normalized = query.toLowerCase();
    const match = queryFixtures.find(entry => entry.query === normalized);
    if (match) {
        return match.vector;
    }

    return [0.5, 0.5, 0.5, 0.5];
}

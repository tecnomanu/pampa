export function reciprocalRankFusion({ vectorResults = [], bm25Results = [], limit = 10, k = 60 }) {
    const scores = new Map();

    const addScores = (items, source) => {
        items.forEach((item, index) => {
            if (!item || typeof item.id === 'undefined') {
                return;
            }

            const rankContribution = 1 / (k + index + 1);
            const existing = scores.get(item.id) || {
                id: item.id,
                score: 0,
                vectorRank: null,
                bm25Rank: null,
                vectorScore: null,
                bm25Score: null
            };

            existing.score += rankContribution;
            if (source === 'vector') {
                existing.vectorRank = index;
                existing.vectorScore = item.score;
            } else if (source === 'bm25') {
                existing.bm25Rank = index;
                existing.bm25Score = item.score;
            }

            scores.set(item.id, existing);
        });
    };

    addScores(vectorResults, 'vector');
    addScores(bm25Results, 'bm25');

    return Array.from(scores.values())
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }

            const aVectorRank = typeof a.vectorRank === 'number' ? a.vectorRank : Number.MAX_SAFE_INTEGER;
            const bVectorRank = typeof b.vectorRank === 'number' ? b.vectorRank : Number.MAX_SAFE_INTEGER;
            if (aVectorRank !== bVectorRank) {
                return aVectorRank - bVectorRank;
            }

            const aBmRank = typeof a.bm25Rank === 'number' ? a.bm25Rank : Number.MAX_SAFE_INTEGER;
            const bBmRank = typeof b.bm25Rank === 'number' ? b.bm25Rank : Number.MAX_SAFE_INTEGER;
            if (aBmRank !== bBmRank) {
                return aBmRank - bBmRank;
            }

            return 0;
        })
        .slice(0, limit);
}

/**
 * Convert a tier name to a numeric rank for comparison.
 *
 * Tier hierarchy:
 *   free     = 0
 *   basic    = 1
 *   standard = 2
 *   premium  = 3
 *
 * Usage: tierRank(user.tier) >= tierRank(content.requiredTier)
 *
 * @param {string} tier - The tier name (free, basic, standard, premium)
 * @returns {number} The numeric rank of the tier
 */
function tierRank(tier) {
  const ranks = { free: 0, basic: 1, standard: 2, premium: 3 };
  return ranks[tier] ?? 0;
}

module.exports = tierRank;

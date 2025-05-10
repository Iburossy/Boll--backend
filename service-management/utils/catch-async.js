/**
 * Wrapper pour gérer les erreurs asynchrones dans les contrôleurs
 * @param {Function} fn - Fonction asynchrone à exécuter
 * @returns {Function} Middleware Express
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync;

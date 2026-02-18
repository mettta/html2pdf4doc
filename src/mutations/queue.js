// Queue of deferred DOM mutations.
// Mutations are registered during calculations and applied later in Preview.

/**
 * Creates a simple in-memory queue for deferred DOM mutation functions.
 */
export function createMutationQueue() {
  const pendingMutations = [];

  return {
    // Register a mutation function for later execution.
    enqueue(mutationFn) {
      if (typeof mutationFn !== 'function') {
        return;
      }
      pendingMutations.push(mutationFn);
    },

    // Apply all queued mutations in registration order and clear the queue.
    flush() {
      for (const mutationFn of pendingMutations) {
        mutationFn();
      }
      pendingMutations.length = 0;
    },
  };
}


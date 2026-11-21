/** Query keys of the feature; invalidate `all` after a command. */
export const ordersQueryKeys = {
  all: ['orders'] as const,
  list: () => [...ordersQueryKeys.all, 'list'] as const,
};

// canary: a server component importing the client platform entry
import { useAppDispatch } from '../../../../../platform/index.client';

export const Screen = (): string => useAppDispatch();

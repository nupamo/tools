import { createContext, use } from 'react';
import ko, { type Messages } from './ko';

// Islands get their messages from the page. Without a provider (tests), Korean is used.
export const MessagesContext = createContext<Messages>(ko);
export const useMessages = () => use(MessagesContext);

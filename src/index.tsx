import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Provider } from './components/ui/provider';
import { StateProvider } from './helpers';

import './index.css';
import HomePage from './pages/HomePage';
import SpadesCalculator from './pages/SpadesCalculator';
import Leaderboard from './pages/Leaderboard';
import PlayerStats from './pages/PlayerStats';
import CompareStats from './pages/CompareStats';
import PlayersPage from './pages/PlayersPage';

import { Toaster } from './components/ui/toaster';

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: 'players',
    element: <PlayersPage />,
  },
  {
    path: 'spades-calculator',
    element: <SpadesCalculator />,
  },
  {
    path: 'leaderboard',
    element: <Leaderboard />,
  },
  {
    path: 'stats',
    element: <CompareStats />,
  },
  {
    path: 'stats/:playerId',
    element: <PlayerStats />,
  },
]);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <Provider>
    <StateProvider>
      <RouterProvider router={router} />
      <Toaster />
    </StateProvider>
  </Provider>,
);

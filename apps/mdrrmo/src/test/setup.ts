import { configure } from '@testing-library/react';

// Screens wait on (mocked) API calls. A longer async timeout keeps tests stable
// on slow or heavily loaded CI machines.
configure({ asyncUtilTimeout: 3000 });

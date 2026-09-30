import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { localNow } from '@beacon/shared';
import { RESIDENT, renderApp, signedInWith } from '../../test/renderApp';
import { loadDraft, newDraft, saveDraft } from './draft/draft';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function startReport() {
  const app = renderApp('/report', signedInWith());
  await userEvent.click(await screen.findByRole('button', { name: 'Start report' }));
  await screen.findByRole('heading', { level: 1, name: 'What type of hazard?' });
  return app;
}

describe('step 1: hazard', () => {
  it('shows the hazard types from the API with progress', async () => {
    await startReport();
    expect(await screen.findByRole('radio', { name: 'Landslide' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Other Hazard' })).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe(
      'Step 1 of 6: Select hazard type',
    );
  });

  it('requires a hazard before continuing', async () => {
    const { router } = await startReport();
    await screen.findByRole('radio', { name: 'Flood' });
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Missing required information')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/report/new/hazard');
  });

  it('asks what the hazard is when "Other Hazard" is chosen', async () => {
    const { router } = await startReport();
    await userEvent.click(await screen.findByRole('radio', { name: 'Other Hazard' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByText('Describe the hazard in a few words').length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText('Describe the hazard'), 'Sinkhole');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/report/new/details'));
    expect(screen.getByText('Other hazard: Sinkhole')).toBeTruthy();
  });
});

describe('step 2: incident details', () => {
  async function toDetails() {
    const app = await startReport();
    await userEvent.click(await screen.findByRole('radio', { name: 'Landslide' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { level: 1, name: 'Incident details' });
    return app;
  }

  it('pre-fills the current Dalaguete date and time', async () => {
    await toDetails();
    const now = localNow();
    expect((screen.getByLabelText('Date of incident') as HTMLInputElement).value).toBe(now.date);
    expect((screen.getByLabelText('Time of incident') as HTMLInputElement).value).toMatch(
      /^\d{2}:\d{2}$/,
    );
  });

  it('requires a description', async () => {
    const { router } = await toDetails();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getAllByText('Describe what happened in at least 10 characters').length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText('What happened?').getAttribute('aria-invalid')).toBe('true');
    expect(router.state.location.pathname).toBe('/report/new/details');
  });

  it('rejects a future date', async () => {
    await toDetails();
    await userEvent.type(screen.getByLabelText('What happened?'), 'Rocks blocked the road.');
    const date = screen.getByLabelText('Date of incident');
    await userEvent.clear(date);
    await userEvent.type(date, '2099-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByText('The incident date cannot be in the future').length).toBeGreaterThan(
      0,
    );
  });

  it('continues to the location step when valid', async () => {
    const { router } = await toDetails();
    await userEvent.type(screen.getByLabelText('What happened?'), 'Rocks blocked the road.');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/report/new/location'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Where did it happen?' }),
    ).toBeTruthy();
  });

  it('goes back to the hazard step keeping the selection', async () => {
    await toDetails();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    const landslide = await screen.findByRole('radio', { name: 'Landslide' });
    expect((landslide as HTMLInputElement).checked).toBe(true);
  });
});

describe('drafts', () => {
  it('saves progress on the device, per resident', async () => {
    await startReport();
    await userEvent.click(await screen.findByRole('radio', { name: 'Flood' }));
    await waitFor(() => expect(loadDraft(RESIDENT.id)?.hazardCode).toBe('flood'));
    expect(loadDraft('someone-else')).toBeNull();
    expect(screen.getByText('Draft saved on this device')).toBeTruthy();
  });

  it('offers to continue or discard a saved draft', async () => {
    saveDraft(RESIDENT.id, {
      ...newDraft(),
      hazardTypeId: 2,
      hazardCode: 'landslide',
      hazardName: 'Landslide',
      description: 'Half-written report',
    });
    const { router } = renderApp('/report', signedInWith());
    expect(await screen.findByRole('heading', { name: 'Unsent draft: Landslide' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start report' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Continue draft' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/report/new/details'));
    expect((screen.getByLabelText('What happened?') as HTMLTextAreaElement).value).toBe(
      'Half-written report',
    );
  });

  it('discards a draft only after confirmation', async () => {
    saveDraft(RESIDENT.id, { ...newDraft(), hazardCode: 'flood', hazardName: 'Flood' });
    renderApp('/report', signedInWith());
    await userEvent.click(await screen.findByRole('button', { name: 'Discard draft' }));
    const confirm = screen.getByText('Discard this draft?').closest('.bcn-alert') as HTMLElement;
    expect(confirm).toBeTruthy();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Discard' }));
    expect(await screen.findByRole('button', { name: 'Start report' })).toBeTruthy();
    expect(loadDraft(RESIDENT.id)).toBeNull();
  });

  it('keeps residents out of later steps without a draft', async () => {
    const { router } = renderApp('/report/new/details', signedInWith());
    await waitFor(() => expect(router.state.location.pathname).toBe('/report'));
  });

  it('is deleted when the resident logs out', async () => {
    saveDraft(RESIDENT.id, newDraft());
    const { router } = renderApp('/profile', signedInWith());
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/welcome'));
    expect(loadDraft(RESIDENT.id)).toBeNull();
  });
});

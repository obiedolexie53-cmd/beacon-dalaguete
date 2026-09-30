import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RESIDENT,
  json,
  makeReport,
  renderApp,
  signedInWith,
  type Handler,
} from '../../test/renderApp';
import { loadDraft, newDraft, saveDraft, type ReportDraft } from './draft/draft';
import { clearAllEvidence, listEvidence, putEvidence } from './evidence/evidenceStore';

afterEach(async () => {
  cleanup();
  await clearAllEvidence();
});

const REF = 'BEA-2026-000125';
const created = makeReport({ reference_no: REF, status: 'submitted' });

async function prepareDraft(files: Array<'photo' | 'video'> = []): Promise<ReportDraft> {
  const draft: ReportDraft = {
    ...newDraft(),
    hazardTypeId: 1,
    hazardCode: 'flood',
    hazardName: 'Flood',
    description: 'Knee-deep water on the road near the market.',
    incidentDate: '2026-09-29',
    incidentTime: '08:15',
    barangayId: 28,
    barangayName: 'Poblacion',
    landmark: 'Public market',
    latitude: 9.7612,
    longitude: 123.5349,
    locationAccuracyM: 10,
    locationSource: 'gps',
  };
  saveDraft(RESIDENT.id, draft);
  for (const [index, kind] of files.entries()) {
    await putEvidence({
      id: `e${index}`,
      draftId: draft.clientRequestId,
      kind,
      blob: new Blob([`file-${index}`], { type: kind === 'photo' ? 'image/jpeg' : 'video/mp4' }),
      mimeType: kind === 'photo' ? 'image/jpeg' : 'video/mp4',
      size: 6,
      addedAt: index,
    });
  }
  return draft;
}

async function confirmAndSubmit() {
  await userEvent.click(await screen.findByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
}

const mediaPath = `/me/reports/${REF}/media`;

describe('review and submit', () => {
  it('shows every section with edit links', async () => {
    await prepareDraft(['photo', 'photo', 'video']);
    renderApp('/report/new/review', signedInWith());
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Review your report' }),
    ).toBeTruthy();
    expect(screen.getByText('Flood')).toBeTruthy();
    expect(screen.getByText('September 29, 2026, 8:15 AM')).toBeTruthy();
    expect(screen.getByText('Poblacion')).toBeTruthy();
    expect(screen.getByText(/9.761200, 123.534900 \(from your phone\)/)).toBeTruthy();
    expect(await screen.findByText(/2 photos and 1 video will be uploaded/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit location' }).getAttribute('href')).toBe(
      '/report/new/location',
    );
  });

  it('requires the resident to confirm the information', async () => {
    await prepareDraft();
    const { calls } = renderApp('/report/new/review', signedInWith());
    await userEvent.click(await screen.findByRole('button', { name: 'Submit report' }));
    expect(screen.getByText('Please confirm that the information is true')).toBeTruthy();
    expect(calls.some((c) => c.path === '/me/reports')).toBe(false);
  });

  it('sends the report, uploads evidence and confirms', async () => {
    const draft = await prepareDraft(['photo', 'video']);
    const { router, calls } = renderApp(
      '/report/new/review',
      signedInWith({
        '/me/reports': () => json(201, created),
        [mediaPath]: () => json(201, { id: 'm' }),
      }),
    );
    await confirmAndSubmit();

    await waitFor(() => expect(router.state.location.pathname).toBe(`/report/submitted/${REF}`));
    expect(
      await screen.findByRole('heading', { name: 'Report Submitted Successfully' }),
    ).toBeTruthy();
    expect(screen.getByText(REF)).toBeTruthy();
    expect(screen.getByText('Submitted')).toBeTruthy();

    expect(calls.find((c) => c.path === '/me/reports')?.body).toEqual({
      client_request_id: draft.clientRequestId,
      hazard_type_id: 1,
      other_hazard_text: null,
      description: 'Knee-deep water on the road near the market.',
      incident_date: '2026-09-29',
      incident_time: '08:15',
      barangay_id: 28,
      landmark: 'Public market',
      latitude: '9.761200',
      longitude: '123.534900',
      location_accuracy_m: 10,
      location_source: 'gps',
    });
    const uploads = calls.filter((c) => c.path === mediaPath);
    expect(uploads).toHaveLength(2);
    expect(uploads[0]!.body).toBeInstanceOf(FormData);

    await waitFor(() => expect(loadDraft(RESIDENT.id)).toBeNull());
    expect(await listEvidence(draft.clientRequestId)).toHaveLength(0);
  });

  it('keeps the draft and explains a connection failure, then retries safely', async () => {
    const draft = await prepareDraft();
    let online = false;
    const { router, calls } = renderApp(
      '/report/new/review',
      signedInWith({
        '/me/reports': () => {
          if (!online) throw new TypeError('Failed to fetch');
          return json(201, created);
        },
      }),
    );
    await confirmAndSubmit();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Report Not Submitted')).toBeTruthy();
    expect(within(alert).getByText(/Please check your connection and try again/)).toBeTruthy();
    expect(loadDraft(RESIDENT.id)).not.toBeNull();

    online = true;
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/report/submitted/${REF}`));
    const ids = calls
      .filter((c) => c.path === '/me/reports')
      .map((c) => (c.body as { client_request_id: string }).client_request_id);
    expect(ids).toEqual([draft.clientRequestId, draft.clientRequestId]);
  });

  it('links field problems back to the right step', async () => {
    await prepareDraft();
    renderApp(
      '/report/new/review',
      signedInWith({
        '/me/reports': () =>
          json(422, {
            error: {
              code: 'validation_error',
              message: 'Please check the highlighted fields.',
              fields: { incident_time: 'The incident time cannot be in the future' },
            },
          }),
      }),
    );
    await confirmAndSubmit();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/The incident time cannot be in the future/)).toBeTruthy();
    expect(
      within(alert).getByRole('link', { name: 'Edit incident details' }).getAttribute('href'),
    ).toBe('/report/new/details');
  });

  it('lets the resident retry evidence that failed to upload', async () => {
    const draft = await prepareDraft(['photo', 'photo']);
    let failPhoto = true;
    let uploads = 0;
    const handler: Handler = signedInWith({
      '/me/reports': () => json(uploads === 0 ? 201 : 200, created),
      [mediaPath]: () => {
        uploads += 1;
        if (failPhoto && uploads === 2) throw new TypeError('Failed to fetch');
        return json(201, { id: `m${uploads}` });
      },
    });
    const { router } = renderApp('/report/new/review', handler);
    await confirmAndSubmit();
    await waitFor(() => expect(router.state.location.pathname).toBe(`/report/submitted/${REF}`));
    expect(await screen.findByText('1 file was not uploaded')).toBeTruthy();
    expect(loadDraft(RESIDENT.id)?.submittedReferenceNo).toBe(REF);
    expect(await listEvidence(draft.clientRequestId)).toHaveLength(1);

    failPhoto = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry upload' }));
    expect(await screen.findByText('All files uploaded')).toBeTruthy();
    await waitFor(() => expect(loadDraft(RESIDENT.id)).toBeNull());
  });

  it('points the Report tab to unfinished uploads', async () => {
    const draft = await prepareDraft(['photo']);
    saveDraft(RESIDENT.id, { ...draft, submittedReferenceNo: REF });
    const { router } = renderApp('/report', signedInWith());
    await userEvent.click(await screen.findByRole('button', { name: 'Finish uploading' }));
    expect(router.state.location.pathname).toBe(`/report/submitted/${REF}`);
    expect(await screen.findByText('1 file was not uploaded')).toBeTruthy();
  });

  it('reports files the server rejected and does not retry them', async () => {
    const draft = await prepareDraft(['video']);
    renderApp(
      '/report/new/review',
      signedInWith({
        '/me/reports': () => json(201, created),
        [mediaPath]: () =>
          json(413, {
            error: { code: 'file_too_large', message: 'This file is too large.' },
          }),
      }),
    );
    await confirmAndSubmit();
    expect(await screen.findByText('Some files could not be added')).toBeTruthy();
    expect(screen.getByText(/A video was not added: This file is too large./)).toBeTruthy();
    expect(await listEvidence(draft.clientRequestId)).toHaveLength(0);
    expect(loadDraft(RESIDENT.id)).toBeNull();
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RESIDENT, renderApp, signedInWith } from '../../test/renderApp';
import { newDraft, saveDraft, type ReportDraft } from './draft/draft';
import { clearAllEvidence, listEvidence } from './evidence/evidenceStore';

afterEach(async () => {
  cleanup();
  await clearAllEvidence();
});

function openEvidenceStep(): { draft: ReportDraft } & ReturnType<typeof renderApp> {
  const draft: ReportDraft = {
    ...newDraft(),
    hazardTypeId: 1,
    hazardCode: 'flood',
    hazardName: 'Flood',
    description: 'Water is knee-deep on the road.',
    barangayId: 28,
    barangayName: 'Poblacion',
    landmark: 'Public market',
  };
  saveDraft(RESIDENT.id, draft);
  return { draft, ...renderApp('/report/new/evidence', signedInWith()) };
}

const photo = (name = 'flood.jpg') => new File(['jpeg-bytes'], name, { type: 'image/jpeg' });
const video = (name = 'clip.mp4', size?: number) => {
  const file = new File(['mp4-bytes'], name, { type: 'video/mp4' });
  if (size) Object.defineProperty(file, 'size', { value: size });
  return file;
};

function pick(testId: string, files: File[]) {
  fireEvent.change(screen.getByTestId(testId), { target: { files } });
}

describe('evidence step', () => {
  it('shows the safety reminder and the limits', async () => {
    openEvidenceStep();
    expect(
      await screen.findByText('Do not put yourself in danger to obtain evidence.'),
    ).toBeTruthy();
    expect(screen.getByText('0 of 5')).toBeTruthy();
    expect(screen.getByText('0 of 2')).toBeTruthy();
    expect(screen.getByTestId('photo-capture').getAttribute('capture')).toBe('environment');
  });

  it('adds photos, keeps them on the device and shows previews', async () => {
    const { draft } = openEvidenceStep();
    await screen.findByText('0 of 5');
    pick('photo-pick', [photo('a.jpg'), photo('b.jpg')]);
    expect(await screen.findByAltText('Preview of photo 2')).toBeTruthy();
    expect(screen.getByText('2 of 5')).toBeTruthy();
    const stored = await listEvidence(draft.clientRequestId);
    expect(stored.map((i) => i.kind)).toEqual(['photo', 'photo']);
  });

  it('keeps evidence after the page is reloaded', async () => {
    const { draft } = openEvidenceStep();
    await screen.findByText('0 of 5');
    pick('video-pick', [video()]);
    await screen.findByLabelText('Preview of video 1');
    cleanup();
    saveDraft(RESIDENT.id, draft);
    renderApp('/report/new/evidence', signedInWith());
    expect(await screen.findByLabelText('Preview of video 1')).toBeTruthy();
  });

  it('removes and replaces evidence', async () => {
    const { draft } = openEvidenceStep();
    await screen.findByText('0 of 5');
    pick('photo-pick', [photo('a.jpg'), photo('b.jpg')]);
    await screen.findByAltText('Preview of photo 2');
    const firstId = (await listEvidence(draft.clientRequestId))[0]!.id;

    await userEvent.click(screen.getByRole('button', { name: 'Replace photo 1' }));
    pick('photo-replace', [photo('better.jpg')]);
    await waitFor(async () => {
      const ids = (await listEvidence(draft.clientRequestId)).map((i) => i.id);
      expect(ids).toHaveLength(2);
      expect(ids).not.toContain(firstId);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Remove photo 2' }));
    await waitFor(() => expect(screen.getByText('1 of 5')).toBeTruthy());
    expect(await listEvidence(draft.clientRequestId)).toHaveLength(1);
  });

  it('explains files that were not added', async () => {
    openEvidenceStep();
    await screen.findByText('0 of 5');
    pick('photo-pick', [new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    pick('video-pick', [video('long.mp4', 60 * 1024 * 1024)]);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Some files were not added')).toBeTruthy();
    expect(screen.getByText(/"long.mp4" is too large \(60 MB\)/)).toBeTruthy();
  });

  it('stops at the photo limit', async () => {
    openEvidenceStep();
    await screen.findByText('0 of 5');
    pick(
      'photo-pick',
      Array.from({ length: 6 }, (_, i) => photo(`p${i}.jpg`)),
    );
    expect(
      await screen.findByText(/A report can have up to 5 photos. "p5.jpg" was not added./),
    ).toBeTruthy();
    expect(screen.getByText('5 of 5')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Take photo' })).toHaveProperty('disabled', true);
  });

  it('is optional and continues to review', async () => {
    const { router } = openEvidenceStep();
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/report/new/review'));
  });

  it('is deleted with the draft', async () => {
    const { draft, router } = openEvidenceStep();
    await screen.findByText('0 of 5');
    pick('photo-pick', [photo()]);
    await screen.findByAltText('Preview of photo 1');
    await router.navigate('/report');
    await userEvent.click(await screen.findByRole('button', { name: 'Discard draft' }));
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(async () => expect(await listEvidence(draft.clientRequestId)).toHaveLength(0));
  });

  it('is deleted on logout', async () => {
    const { draft, router } = openEvidenceStep();
    await screen.findByText('0 of 5');
    pick('photo-pick', [photo()]);
    await screen.findByAltText('Preview of photo 1');
    await router.navigate('/profile');
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    await waitFor(async () => expect(await listEvidence(draft.clientRequestId)).toHaveLength(0));
  });
});

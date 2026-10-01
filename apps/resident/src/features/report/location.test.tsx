import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DALAGUETE_DEMO_CENTER } from '@beacon/shared';
import { RESIDENT, renderApp, signedInWith } from '../../test/renderApp';
import { loadDraft, newDraft, saveDraft } from './draft/draft';

type Success = (p: GeolocationPosition) => void;
type Failure = (e: GeolocationPositionError) => void;

function mockGeolocation(
  respond: (success: Success, failure: Failure) => void,
): ReturnType<typeof vi.fn> {
  const getCurrentPosition = vi.fn((success: Success, failure: Failure) =>
    respond(success, failure),
  );
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
  return getCurrentPosition;
}

const position = (latitude: number, longitude: number, accuracy: number) =>
  ({ coords: { latitude, longitude, accuracy } }) as GeolocationPosition;

const geoError = (code: number) =>
  ({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as GeolocationPositionError;

function openLocationStep() {
  saveDraft(RESIDENT.id, {
    ...newDraft(),
    hazardTypeId: 2,
    hazardCode: 'landslide',
    hazardName: 'Landslide',
    description: 'Rocks blocked the road.',
  });
  return renderApp('/report/new/location', signedInWith());
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'geolocation');
});

describe('location step', () => {
  it('uses the phone location and shows the coordinates', async () => {
    mockGeolocation((success) => success(position(9.84123456, 123.4873, 12)));
    openLocationStep();
    await userEvent.click(await screen.findByRole('button', { name: 'Use my current location' }));

    expect(await screen.findByText('Location found')).toBeTruthy();
    expect(screen.getByText('9.841235, 123.487300')).toBeTruthy();
    expect(screen.getByText(/from your phone/)).toBeTruthy();
    await waitFor(() =>
      expect(loadDraft(RESIDENT.id)).toMatchObject({
        latitude: 9.841235,
        longitude: 123.4873,
        locationAccuracyM: 12,
        locationSource: 'gps',
      }),
    );
  });

  it('warns when the GPS reading is imprecise', async () => {
    mockGeolocation((success) => success(position(9.8412, 123.4873, 350)));
    openLocationStep();
    await userEvent.click(await screen.findByRole('button', { name: 'Use my current location' }));
    expect(await screen.findByText('Location is approximate')).toBeTruthy();
  });

  it('explains a denied permission and asks for a landmark instead', async () => {
    mockGeolocation((_, failure) => failure(geoError(1)));
    const { router } = openLocationStep();
    await userEvent.click(await screen.findByRole('button', { name: 'Use my current location' }));
    expect(await screen.findByText('Location permission denied')).toBeTruthy();

    await userEvent.selectOptions(await screen.findByLabelText('Barangay'), 'Mantalongon');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getAllByText('Add a nearby landmark, or set the location on the map').length,
    ).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText('Nearby landmark'), 'Near the barangay hall');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/report/new/evidence'));
  });

  it('requires a barangay', async () => {
    openLocationStep();
    await userEvent.type(await screen.findByLabelText('Nearby landmark'), 'Near the chapel');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getAllByText('Select the barangay where the incident happened').length,
    ).toBeGreaterThan(0);
  });

  it('rejects a location outside Dalaguete', async () => {
    mockGeolocation((success) => success(position(10.3157, 123.8854, 10))); // Cebu City
    openLocationStep();
    await userEvent.click(await screen.findByRole('button', { name: 'Use my current location' }));
    await screen.findByText('Location found');
    await userEvent.selectOptions(await screen.findByLabelText('Barangay'), 'Poblacion');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getAllByText(
        'The pin appears to be outside Dalaguete. Move it to the incident location.',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('lets the resident place and remove a pin on the map', async () => {
    openLocationStep();
    await userEvent.click(await screen.findByRole('button', { name: 'Place pin at map centre' }));
    const { latitude, longitude } = DALAGUETE_DEMO_CENTER;
    expect(await screen.findByText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)).toBeTruthy();
    expect(screen.getByText(/placed on the map/)).toBeTruthy();
    expect(loadDraft(RESIDENT.id)?.locationSource).toBe('map_pin');

    await userEvent.click(screen.getByRole('button', { name: 'Remove pin' }));
    expect(await screen.findByText(/No pin yet/)).toBeTruthy();
  });

  it('continues with a pin and a barangay, without a landmark', async () => {
    const { router } = openLocationStep();
    await userEvent.click(await screen.findByRole('button', { name: 'Place pin at map centre' }));
    await userEvent.selectOptions(await screen.findByLabelText('Barangay'), 'Poblacion');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/report/new/evidence'));
    expect(loadDraft(RESIDENT.id)).toMatchObject({ barangayId: 28, barangayName: 'Poblacion' });
  });

  it('upgrades drafts saved before the location step existed', () => {
    const legacy = { ...newDraft() } as Record<string, unknown>;
    for (const key of ['barangayId', 'landmark', 'latitude', 'longitude', 'locationSource']) {
      delete legacy[key];
    }
    localStorage.setItem(`beacon.reportDraft.${RESIDENT.id}`, JSON.stringify(legacy));
    expect(loadDraft(RESIDENT.id)).toMatchObject({
      landmark: '',
      latitude: null,
      barangayId: null,
    });
  });
});

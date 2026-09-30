import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { LocateFixed, MapPinOff } from 'lucide-react';
import { useApiQuery } from '@beacon/auth';
import {
  LANDMARK_MAX,
  LOW_ACCURACY_METERS,
  MUNICIPALITY,
  PROVINCE,
  validateLocationStep,
  type Barangay,
} from '@beacon/shared';
import { Alert, Button, Card, SelectField, TextField, useOnlineStatus } from '@beacon/ui';
import { LoadError } from '../../reports/LoadError';
import { useReportDraft } from '../draft/ReportDraftProvider';
import { ErrorSummary } from '../ErrorSummary';
import { StepActions } from '../StepActions';
import { GeolocationMessage } from '../location/GeolocationMessage';
import { MapPicker, type MapPoint } from '../location/MapPicker';
import { useGeolocation } from '../location/useGeolocation';

export function LocationStep() {
  const navigate = useNavigate();
  const { draft, updateDraft } = useReportDraft();
  const barangays = useApiQuery<Barangay[]>('/barangays');
  const [errors, setErrors] = useState<ReturnType<typeof validateLocationStep>>({});
  const [focusKey, setFocusKey] = useState(0);
  const online = useOnlineStatus();
  const geo = useGeolocation((fix) => {
    updateDraft({
      latitude: fix.latitude,
      longitude: fix.longitude,
      locationAccuracyM: fix.accuracy,
      locationSource: 'gps',
    });
    setErrors((e) => ({ ...e, map: undefined, landmark: undefined }));
    setFocusKey((k) => k + 1);
  });

  if (!draft) return null;
  const pin: MapPoint | null =
    draft.latitude !== null && draft.longitude !== null
      ? { latitude: draft.latitude, longitude: draft.longitude }
      : null;

  function pickOnMap(point: MapPoint) {
    // A manually placed pin replaces the GPS reading and its accuracy.
    updateDraft({ ...point, locationAccuracyM: null, locationSource: 'map_pin' });
    setErrors((e) => ({ ...e, map: undefined, landmark: undefined }));
  }

  function removePin() {
    geo.reset();
    updateDraft({ latitude: null, longitude: null, locationAccuracyM: null, locationSource: null });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateLocationStep(draft!);
    setErrors(found);
    if (Object.keys(found).length === 0) navigate('/report/new/evidence');
  }

  const lowAccuracy =
    draft.locationSource === 'gps' &&
    draft.locationAccuracyM !== null &&
    draft.locationAccuracyM > LOW_ACCURACY_METERS;

  return (
    <form className="bcn-stack" onSubmit={handleSubmit} noValidate>
      <PageHeaderLite />
      <ErrorSummary errors={errors} />

      <Card className="bcn-stack" aria-labelledby="map-heading">
        <h2 id="map-heading" className="r-card-heading">
          Map location
        </h2>
        <Button
          variant="primary"
          block
          loading={geo.state.status === 'locating'}
          icon={<LocateFixed size={20} aria-hidden="true" />}
          onClick={geo.request}
        >
          {geo.state.status === 'locating' ? 'Finding your location…' : 'Use my current location'}
        </Button>
        <GeolocationMessage
          state={geo.state}
          lowAccuracy={lowAccuracy}
          accuracy={draft.locationAccuracyM}
          pinFromGps={draft.locationSource === 'gps'}
        />

        {!online && (
          <Alert tone="warning" title="Map unavailable offline">
            The map needs an internet connection. You can still describe the location with a
            landmark below.
          </Alert>
        )}
        <MapPicker
          position={pin}
          accuracy={draft.locationSource === 'gps' ? draft.locationAccuracyM : null}
          focusKey={focusKey}
          onPick={pickOnMap}
        />
        <p className="r-map-help">Tap the map to place the pin, or drag the pin to adjust it.</p>
        {errors.map && (
          <Alert tone="danger" title="Check the pin">
            {errors.map}
          </Alert>
        )}

        {pin ? (
          <div className="r-coordinates">
            <span>
              <span className="bcn-muted">GPS coordinates</span>
              <br />
              <strong>
                {pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}
              </strong>
              <span className="bcn-muted">
                {' '}
                · {draft.locationSource === 'gps' ? 'from your phone' : 'placed on the map'}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              icon={<MapPinOff size={18} aria-hidden="true" />}
              onClick={removePin}
            >
              Remove pin
            </Button>
          </div>
        ) : (
          <p className="bcn-muted" style={{ margin: 0, fontSize: 'var(--bcn-text-sm)' }}>
            No pin yet. If you cannot set one, describe the place with a landmark below.
          </p>
        )}
      </Card>

      {barangays.error ? (
        <LoadError
          title="Could not load barangays"
          error={barangays.error}
          onRetry={barangays.reload}
        />
      ) : (
        <SelectField
          label="Barangay"
          required
          disabled={!barangays.data}
          value={draft.barangayId ?? ''}
          onChange={(e) => {
            const chosen = barangays.data?.find((b) => b.id === Number(e.target.value));
            updateDraft({ barangayId: chosen?.id ?? null, barangayName: chosen?.name ?? null });
          }}
          error={errors.barangay}
        >
          <option value="">{barangays.data ? 'Select the barangay' : 'Loading barangays…'}</option>
          {barangays.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
      )}

      <TextField
        label="Nearby landmark"
        hint={
          pin
            ? 'Optional but helpful, e.g. near the chapel, beside the elementary school'
            : 'Required without a map pin, e.g. near the chapel, beside the elementary school'
        }
        required={!pin}
        maxLength={LANDMARK_MAX}
        value={draft.landmark}
        onChange={(e) => updateDraft({ landmark: e.target.value })}
        error={errors.landmark}
      />

      <div className="r-fixed-field">
        <span className="bcn-muted">Municipality</span>
        <strong>
          {MUNICIPALITY}, {PROVINCE}
        </strong>
      </div>

      <StepActions onBack={() => navigate('/report/new/details')} />
    </form>
  );
}

function PageHeaderLite() {
  return (
    <header className="bcn-page-header">
      <div className="bcn-page-header__text">
        <h1 className="bcn-page-header__title" tabIndex={-1}>
          Where did it happen?
        </h1>
        <p className="bcn-page-header__subtitle">
          Set the location on the map and tell us the barangay and a nearby landmark.
        </p>
      </div>
    </header>
  );
}

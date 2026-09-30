/**
 * Privacy notice shown before registration.
 *
 * DRAFT for the research prototype: retention periods and contact details must
 * be confirmed by the research team and the LGU's Data Protection Officer
 * before evaluation with real residents (Data Privacy Act of 2012, RA 10173).
 */
export const PRIVACY_NOTICE_VERSION = '2026-09';

export function PrivacyNotice() {
  return (
    <div className="r-privacy">
      <p>
        <strong>BEACON</strong> is a community disaster reporting prototype for the Municipality of
        Dalaguete, Cebu. It follows the Data Privacy Act of 2012 (Republic Act No. 10173).
      </p>
      <h3>What we collect</h3>
      <ul>
        <li>Your name, email address and/or mobile number, and barangay</li>
        <li>
          The disaster reports you submit, including the incident location (GPS), photos and videos
        </li>
        <li>Basic security records such as sign-in times</li>
      </ul>
      <h3>Why we collect it</h3>
      <ul>
        <li>So authorized MDRRMO personnel can review, verify and respond to your reports</li>
        <li>So you can track the status of your reports</li>
        <li>
          To analyse recorded reports for recurring hazard patterns. Analysis uses report data, not
          your personal details.
        </li>
      </ul>
      <h3>Who can see it</h3>
      <p>
        Only you and authorized Dalaguete MDRRMO personnel. Your reports are never shown to other
        residents or published.
      </p>
      <h3>Your rights</h3>
      <p>
        You may ask to access, correct or delete your personal information, or withdraw consent, by
        contacting the Dalaguete MDRRMO.
      </p>
      <p className="bcn-muted" style={{ fontSize: 'var(--bcn-text-sm)' }}>
        Version {PRIVACY_NOTICE_VERSION} · Research prototype
      </p>
    </div>
  );
}

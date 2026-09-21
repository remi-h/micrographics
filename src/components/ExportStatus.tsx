export type ExportStatusMessage = {
  // Bumped per export, so two identical results in a row are two separate
  // messages. Keying the paragraph on it re-inserts the node, which is what
  // makes a screen reader read the second one out: text that does not change
  // is not an update.
  id: number;
  text: string;
  tone: 'error' | 'success';
};

// The exporters used to fail in silence: a rejected decode, a null 2D context
// or a null toBlob each left the user with no file and nothing said. This is
// the smallest surface that fixes that -- one line, in the panel's own idiom.
//
// The live region is the wrapper, which is always in the DOM, and only its
// child comes and goes. A region that is itself mounted alongside its first
// message (or hidden with `display: none` between messages) is often missed by
// screen readers; one that is already there when the text arrives is not. It is
// positioned rather than laid out, so an empty one costs no space.
export function ExportStatus({ message }: { message: ExportStatusMessage | null }) {
  return (
    <div className="export-status" role="status" aria-live="polite">
      {message ? (
        <p className="export-status-message" data-tone={message.tone} key={message.id}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

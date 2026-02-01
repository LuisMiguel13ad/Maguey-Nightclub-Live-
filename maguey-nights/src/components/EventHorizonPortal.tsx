interface EventHorizonPortalProps {
  className?: string;
}

export const EventHorizonPortal = ({ className = '' }: EventHorizonPortalProps) => {
  return (
    <div
      className={`fixed inset-0 -z-10 overflow-hidden ${className}`}
      style={{ background: '#000000' }}
    >
      <iframe
        src="https://unicorn.studio/embed/qkbhaNymbsoGqVvxeULj"
        width="100%"
        height="100%"
        style={{
          border: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
        title="Background Effect"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
      />
    </div>
  );
};

export default EventHorizonPortal;

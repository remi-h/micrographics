export function MicroMark({ color, mark, x, y }: { color: string; mark: string; x: number; y: number }) {
  if (mark === 'orbit') {
    return (
      <g fill="none" stroke={color} strokeWidth="1">
        {Array.from({ length: 6 }, (_, index) => (
          <circle key={index} cx={x} cy={y} r={5 + index * 3} opacity={1 - index * 0.1} />
        ))}
      </g>
    );
  }
  if (mark === 'sun') {
    return (
      <g stroke={color} strokeWidth="1.5">
        {Array.from({ length: 12 }, (_, index) => (
          <line
            key={index}
            x1={x}
            x2={x}
            y1={y - 4}
            y2={y - 14}
            transform={`rotate(${index * 30} ${x} ${y})`}
          />
        ))}
        <circle cx={x} cy={y} r="3" fill={color} />
      </g>
    );
  }
  if (mark === 'chevrons') {
    return (
      <g fill="none" stroke={color} strokeWidth="2">
        {[0, 8, 16].map((offset) => (
          <path key={offset} d={`M ${x - 12 + offset} ${y - 8} L ${x - 4 + offset} ${y} L ${x - 12 + offset} ${y + 8}`} />
        ))}
      </g>
    );
  }
  if (mark === 'ce') {
    return (
      <text x={x - 13} y={y + 7} fill={color} fontFamily="Arial, sans-serif" fontSize="19" fontWeight="800">
        CE
      </text>
    );
  }
  if (mark === 'anchor') {
    return (
      <g fill="none" stroke={color} strokeLinecap="round" strokeWidth="2">
        <path d={`M ${x} ${y - 13} V ${y + 9} M ${x - 11} ${y - 2} Q ${x} ${y + 18} ${x + 11} ${y - 2}`} />
        <line x1={x - 8} x2={x + 8} y1={y - 4} y2={y - 4} />
        <circle cx={x} cy={y - 14} r="3" />
      </g>
    );
  }
  if (mark === 'signal' || mark === 'tally') {
    return (
      <g stroke={color} strokeWidth="1.6">
        {Array.from({ length: 5 }, (_, index) => (
          <line key={index} x1={x - 10 + index * 5} x2={x - 6 + index * 5} y1={y + 12} y2={y - 12} />
        ))}
      </g>
    );
  }
  if (mark === 'triple') {
    return (
      <g fill="none" stroke={color} strokeWidth="1.7">
        <circle cx={x - 8} cy={y} r="6" />
        <circle cx={x} cy={y} r="6" />
        <circle cx={x + 8} cy={y} r="6" />
      </g>
    );
  }
  if (mark === 'eye') {
    return (
      <g fill="none" stroke={color} strokeWidth="2">
        <path d={`M ${x - 16} ${y} Q ${x} ${y - 12} ${x + 16} ${y} Q ${x} ${y + 12} ${x - 16} ${y}`} />
        <circle cx={x} cy={y} r="4" fill={color} />
      </g>
    );
  }
  if (mark === 'flower') {
    return (
      <g fill="none" stroke={color} strokeWidth="1">
        {Array.from({ length: 6 }, (_, index) => (
          <ellipse key={index} cx={x} cy={y - 8} rx="8" ry="14" transform={`rotate(${index * 60} ${x} ${y})`} />
        ))}
      </g>
    );
  }
  if (mark === 'spiral') {
    return <path d={`M ${x - 12} ${y} A 12 12 0 1 0 ${x + 9} ${y - 7} A 7 7 0 1 1 ${x - 2} ${y - 5}`} fill="none" stroke={color} strokeWidth="2" />;
  }
  if (mark === 'badge') return <rect x={x - 18} y={y - 8} width="36" height="16" rx="8" fill="none" stroke={color} strokeWidth="1.5" />;
  if (mark === 'asterisk' || mark === 'spark') {
    return (
      <g stroke={color} strokeWidth="1.5">
        {Array.from({ length: 8 }, (_, index) => (
          <line key={index} x1={x} x2={x} y1={y - 3} y2={y - 16} transform={`rotate(${index * 45} ${x} ${y})`} />
        ))}
      </g>
    );
  }
  if (mark === 'umbrella') return <path d={`M ${x - 14} ${y} Q ${x} ${y - 18} ${x + 14} ${y} H ${x} V ${y + 16}`} fill="none" stroke={color} strokeWidth="2" />;
  if (mark === 'layers') {
    return (
      <g fill="none" stroke={color} strokeWidth="1.2">
        {[0, 6, 12].map((offset) => (
          <path key={offset} d={`M ${x} ${y - 15 + offset} L ${x + 15} ${y - 8 + offset} L ${x} ${y - 1 + offset} L ${x - 15} ${y - 8 + offset} Z`} />
        ))}
      </g>
    );
  }
  if (mark === 'info') {
    return (
      <g>
        <circle cx={x} cy={y} r="13" fill="none" stroke={color} strokeWidth="2" />
        <text x={x - 3.5} y={y + 6} fill={color} fontFamily="Arial, sans-serif" fontSize="17" fontWeight="800">
          !
        </text>
      </g>
    );
  }
  if (mark === 'quarter') {
    return (
      <g>
        <circle cx={x} cy={y} r="13" fill="none" stroke={color} strokeWidth="1.5" />
        <path d={`M ${x} ${y - 13} A 13 13 0 0 1 ${x + 13} ${y} L ${x} ${y} Z`} fill={color} />
      </g>
    );
  }
  if (mark === 'head') return <path d={`M ${x - 8} ${y + 14} V ${y + 6} Q ${x - 16} ${y - 1} ${x - 9} ${y - 11} Q ${x + 8} ${y - 22} ${x + 13} ${y - 4} Q ${x + 15} ${y + 9} ${x + 6} ${y + 13} Z`} fill="none" stroke={color} strokeWidth="1.7" />;
  if (mark === 'bracket') return <path d={`M ${x - 13} ${y - 14} H ${x - 5} V ${y + 14} H ${x - 13} M ${x + 13} ${y - 14} H ${x + 5} V ${y + 14} H ${x + 13}`} fill="none" stroke={color} strokeWidth="2" />;
  if (mark === 'waves') {
    return (
      <g fill={color}>
        <path d={`M ${x - 18} ${y - 12} C ${x - 7} ${y - 9} ${x - 7} ${y + 9} ${x - 18} ${y + 12} Z`} />
        <path d={`M ${x + 18} ${y - 12} C ${x + 7} ${y - 9} ${x + 7} ${y + 9} ${x + 18} ${y + 12} Z`} />
        <rect x={x - 4} y={y - 14} width="8" height="28" />
      </g>
    );
  }
  if (mark === 'fingerprint') {
    return (
      <g fill="none" stroke={color} strokeWidth="1.3">
        {Array.from({ length: 5 }, (_, index) => (
          <path key={index} d={`M ${x - 9 + index * 3} ${y + 12} C ${x - 18} ${y - 5} ${x - 4} ${y - 17} ${x + 7} ${y - 11} C ${x + 18} ${y - 5} ${x + 9} ${y + 12} ${x + index * 2} ${y + 14}`} />
        ))}
      </g>
    );
  }
  if (mark === 'expand') return <path d={`M ${x - 14} ${y - 4} V ${y - 14} H ${x - 4} M ${x + 4} ${y - 14} H ${x + 14} V ${y - 4} M ${x + 14} ${y + 4} V ${y + 14} H ${x + 4} M ${x - 4} ${y + 14} H ${x - 14} V ${y + 4}`} fill="none" stroke={color} strokeWidth="2" />;
  if (mark === 'nodes') {
    return (
      <g fill={color}>
        {Array.from({ length: 9 }, (_, index) => (
          <circle key={index} cx={x - 12 + (index % 3) * 12} cy={y - 12 + Math.floor(index / 3) * 12} r={index % 2 ? 3 : 4} />
        ))}
      </g>
    );
  }
  if (mark === 'arrows') return <path d={`M ${x - 15} ${y - 7} H ${x + 9} L ${x + 2} ${y - 14} M ${x + 15} ${y + 7} H ${x - 9} L ${x - 2} ${y + 14}`} fill="none" stroke={color} strokeWidth="2" />;
  if (mark === 'globe') {
    return (
      <g fill="none" stroke={color} strokeWidth="1.4">
        <circle cx={x} cy={y} r="13" />
        <ellipse cx={x} cy={y} rx="6" ry="13" />
        <line x1={x - 12} x2={x + 12} y1={y} y2={y} />
      </g>
    );
  }
  if (mark === 'flag') return <path d={`M ${x - 12} ${y + 15} V ${y - 14} H ${x + 11} V ${y - 2} H ${x - 12}`} fill="none" stroke={color} strokeWidth="2" />;
  if (mark === 'grid') {
    return (
      <g fill="none" stroke={color} strokeWidth="1.2">
        {Array.from({ length: 4 }, (_, index) => (
          <line key={`v-${index}`} x1={x - 12 + index * 8} x2={x - 12 + index * 8} y1={y - 12} y2={y + 12} />
        ))}
        {Array.from({ length: 4 }, (_, index) => (
          <line key={`h-${index}`} x1={x - 12} x2={x + 12} y1={y - 12 + index * 8} y2={y - 12 + index * 8} />
        ))}
      </g>
    );
  }
  if (mark === 'circle') return <circle cx={x} cy={y} r="7" fill="none" stroke={color} strokeWidth="2" />;
  if (mark === 'square') return <rect x={x - 6} y={y - 6} width="12" height="12" fill={color} />;
  if (mark === 'tri') return <path d={`M ${x} ${y - 8} L ${x + 8} ${y + 7} L ${x - 8} ${y + 7} Z`} fill="none" stroke={color} strokeWidth="2" />;
  if (mark === 'bar') return <rect x={x - 3} y={y - 12} width="6" height="24" fill={color} />;
  return (
    <g stroke={color} strokeWidth="2">
      <line x1={x - 8} x2={x + 8} y1={y} y2={y} />
      <line x1={x} x2={x} y1={y - 8} y2={y + 8} />
    </g>
  );
}

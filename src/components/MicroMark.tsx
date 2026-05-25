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
  if (mark === 'mc') {
    return (
      <g fill={color}>
        <path d={`M ${x - 16} ${y - 8} C ${x - 24} ${y - 8} ${x - 24} ${y + 8} ${x - 16} ${y + 8} C ${x - 9} ${y + 8} ${x - 9} ${y - 8} ${x - 16} ${y - 8} Z`} />
        <path d={`M ${x - 5} ${y - 8} C ${x - 13} ${y - 8} ${x - 13} ${y + 8} ${x - 5} ${y + 8} C ${x + 2} ${y + 8} ${x + 2} ${y - 8} ${x - 5} ${y - 8} Z`} />
        <path d={`M ${x + 15} ${y - 9} C ${x + 4} ${y - 9} ${x + 4} ${y + 9} ${x + 15} ${y + 9} L ${x + 15} ${y + 4} C ${x + 11} ${y + 4} ${x + 11} ${y - 4} ${x + 15} ${y - 4} Z`} />
      </g>
    );
  }
  if (mark === 'diamond') {
    return <path d={`M ${x} ${y - 12} L ${x + 12} ${y} L ${x} ${y + 12} L ${x - 12} ${y} Z`} fill="none" stroke={color} strokeWidth="1.7" />;
  }
  if (mark === 'line') return <line x1={x - 16} x2={x + 16} y1={y} y2={y} stroke={color} strokeLinecap="round" strokeWidth="2" />;
  if (mark === 'tally') {
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
  if (mark === 'target') {
    return (
      <g fill="none" stroke={color} strokeWidth="1.3">
        <circle cx={x} cy={y} r="10" />
        <circle cx={x} cy={y} r="3" fill={color} />
        <line x1={x - 15} x2={x - 7} y1={y} y2={y} />
        <line x1={x + 7} x2={x + 15} y1={y} y2={y} />
        <line x1={x} x2={x} y1={y - 15} y2={y - 7} />
        <line x1={x} x2={x} y1={y + 7} y2={y + 15} />
      </g>
    );
  }
  if (mark === 'warning') {
    return (
      <g fill="none" stroke={color} strokeLinejoin="round" strokeWidth="2">
        <path d={`M ${x} ${y - 15} L ${x + 16} ${y + 13} H ${x - 16} Z`} />
        <line x1={x} x2={x} y1={y - 5} y2={y + 5} strokeLinecap="round" />
        <circle cx={x} cy={y + 10} r="1.6" fill={color} stroke="none" />
      </g>
    );
  }
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
  if (mark === 'arch') {
    return (
      <g fill="none" stroke={color} strokeLinecap="round" strokeWidth="2">
        <path d={`M ${x - 12} ${y + 14} V ${y - 2} Q ${x - 12} ${y - 14} ${x} ${y - 14} Q ${x + 12} ${y - 14} ${x + 12} ${y - 2} V ${y + 14}`} />
        <path d={`M ${x - 6} ${y + 14} V ${y - 2} Q ${x - 6} ${y - 8} ${x} ${y - 8} Q ${x + 6} ${y - 8} ${x + 6} ${y - 2} V ${y + 14}`} />
      </g>
    );
  }
  if (mark === 'fingerprint') {
    return (
      <g fill="none" stroke={color} strokeLinecap="round" strokeWidth="1.55">
        <path d={`M ${x - 16} ${y + 5} C ${x - 18} ${y - 8} ${x - 9} ${y - 18} ${x + 1} ${y - 18} C ${x + 12} ${y - 18} ${x + 19} ${y - 10} ${x + 19} ${y + 1}`} opacity="0.75" />
        <path d={`M ${x - 13} ${y + 11} C ${x - 17} ${y - 3} ${x - 9} ${y - 15} ${x + 1} ${y - 15} C ${x + 10} ${y - 15} ${x + 16} ${y - 8} ${x + 16} ${y + 1} C ${x + 16} ${y + 6} ${x + 14} ${y + 9} ${x + 12} ${y + 12}`} />
        <path d={`M ${x - 9} ${y + 14} C ${x - 13} ${y + 2} ${x - 7} ${y - 11} ${x + 1} ${y - 11} C ${x + 8} ${y - 11} ${x + 12} ${y - 6} ${x + 12} ${y + 1} C ${x + 12} ${y + 7} ${x + 9} ${y + 11} ${x + 6} ${y + 15}`} />
        <path d={`M ${x - 4} ${y + 16} C ${x - 8} ${y + 7} ${x - 5} ${y - 7} ${x + 1} ${y - 7} C ${x + 6} ${y - 7} ${x + 8} ${y - 3} ${x + 8} ${y + 2} C ${x + 8} ${y + 8} ${x + 5} ${y + 12} ${x + 2} ${y + 16}`} />
        <path d={`M ${x + 1} ${y + 13} C ${x + 3} ${y + 10} ${x + 5} ${y + 6} ${x + 5} ${y + 2} C ${x + 5} ${y - 1} ${x + 4} ${y - 3} ${x + 1} ${y - 3} C ${x - 2} ${y - 3} ${x - 3} ${y + 1} ${x - 2} ${y + 6}`} />
        <path d={`M ${x - 16} ${y - 2} C ${x - 16} ${y - 12} ${x - 8} ${y - 21} ${x + 2} ${y - 21}`} opacity="0.9" />
        <path d={`M ${x + 7} ${y - 20} C ${x + 16} ${y - 17} ${x + 22} ${y - 10} ${x + 22} ${y - 1}`} opacity="0.9" />
      </g>
    );
  }
  if (mark === 'expand') return <path d={`M ${x - 14} ${y - 4} V ${y - 14} H ${x - 4} M ${x + 4} ${y - 14} H ${x + 14} V ${y - 4} M ${x + 14} ${y + 4} V ${y + 14} H ${x + 4} M ${x - 4} ${y + 14} H ${x - 14} V ${y + 4}`} fill="none" stroke={color} strokeWidth="2" />;
  if (mark === 'triad') {
    return (
      <g fill={color}>
        <circle cx={x} cy={y - 10} r="6" />
        <circle cx={x - 9} cy={y + 7} r="6" />
        <circle cx={x + 9} cy={y + 7} r="6" />
        <circle cx={x} cy={y} r="4" />
      </g>
    );
  }
  if (mark === 'swapbox') {
    return (
      <g fill="none" stroke={color} strokeWidth="1.8">
        <rect x={x - 14} y={y - 14} width="28" height="28" rx="2" />
        <path d={`M ${x - 8} ${y - 4} H ${x + 5} L ${x + 1} ${y - 8} M ${x + 8} ${y + 4} H ${x - 5} L ${x - 1} ${y + 8}`} />
      </g>
    );
  }
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
  if (mark === 'turn') {
    return <path d={`M ${x - 12} ${y - 4} H ${x + 7} Q ${x + 14} ${y - 4} ${x + 14} ${y + 3} V ${y + 9} M ${x + 6} ${y + 2} L ${x + 14} ${y + 10} L ${x + 22} ${y + 2}`} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />;
  }
  if (mark === 'temple') {
    return (
      <g fill="none" stroke={color} strokeLinecap="round" strokeWidth="1.8">
        <path d={`M ${x - 14} ${y - 4} H ${x + 14} M ${x - 10} ${y - 4} V ${y + 12} M ${x} ${y - 4} V ${y + 12} M ${x + 10} ${y - 4} V ${y + 12} M ${x - 16} ${y + 12} H ${x + 16}`} />
        <path d={`M ${x - 10} ${y - 5} V ${y - 10} Q ${x - 10} ${y - 15} ${x - 5} ${y - 15} H ${x + 5} Q ${x + 10} ${y - 15} ${x + 10} ${y - 10} V ${y - 5}`} />
      </g>
    );
  }
  if (mark === 'flag') return <path d={`M ${x - 12} ${y + 15} V ${y - 14} H ${x + 11} V ${y - 2} H ${x - 12}`} fill="none" stroke={color} strokeWidth="2" />;
  if (mark === 'leaf') {
    return (
      <g fill={color}>
        {[0, 1, 2, 3].map((index) => (
          <path key={index} d={`M ${x} ${y + 14 - index * 7} C ${x - 11} ${y + 10 - index * 7} ${x - 12} ${y + 1 - index * 7} ${x} ${y + 5 - index * 7} C ${x + 12} ${y + 1 - index * 7} ${x + 11} ${y + 10 - index * 7} ${x} ${y + 14 - index * 7} Z`} />
        ))}
      </g>
    );
  }
  if (mark === 'swirl') {
    return (
      <g fill="none" stroke={color} strokeWidth="1.4">
        {Array.from({ length: 8 }, (_, index) => (
          <path key={index} d={`M ${x} ${y} C ${x + 4} ${y - 8} ${x + 16} ${y - 8} ${x + 15} ${y + 2}`} transform={`rotate(${index * 45} ${x} ${y})`} />
        ))}
      </g>
    );
  }
  if (mark === 'camera') {
    return (
      <g fill="none" stroke={color} strokeWidth="2">
        <rect x={x - 15} y={y - 12} width="30" height="24" rx="3" />
        <circle cx={x} cy={y} r="7" />
        <rect x={x - 6} y={y - 17} width="12" height="5" rx="1" fill={color} stroke="none" />
      </g>
    );
  }
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

import React from 'react';

// Ghost relation button rendered inside the tree SVG.
// The circular background is filled with the relation color and the icon
// is rendered white for contrast (using the SVG paths provided by the user).
export default function GhostRelationButton({ direction = 'top', onActivate = () => {}, label = '', relation = '', size = 24, className = '' }) {
  const colorForRelation = {
    parent: '#2563eb', // blue
    child: '#2563eb',
    spouse: '#10b981', // green
    partner: '#10b981',
    sibling: '#6b7280' // gray
  };
  const color = colorForRelation[relation] || '#374151';

  import React from 'react';

  export default function GhostRelationButton({ direction = 'top', onActivate = () => {}, label = '', relation = '', size = 24, className = '' }) {
    const colorForRelation = {
      parent: '#2563eb',
      child: '#2563eb',
      spouse: '#10b981',
      partner: '#10b981',
      sibling: '#6b7280'
    };
    const color = colorForRelation[relation] || '#374151';

    return (
      <g className={`ghost-relation-btn ${className} ghost-${direction}`} role="button" tabIndex={0} aria-label={label} onClick={(e) => { e.stopPropagation(); onActivate(e); }}>
        <circle cx={0} cy={0} r={size/2} fill={color} />
      </g>
    );
  }

    // Ghost relation button rendered inside the tree SVG.
    // The circular background is filled with the relation color and the icon
    // is rendered white for contrast (using the SVG paths provided by the user).
    export default function GhostRelationButton({ direction = 'top', onActivate = () => {}, label = '', relation = '', size = 24, className = '' }) {
        const colorForRelation = {
            parent: '#2563eb', // blue
            child: '#2563eb',
            spouse: '#10b981', // green
            partner: '#10b981',
            sibling: '#6b7280' // gray
        };
        const color = colorForRelation[relation] || '#374151';

        const icon = (() => {
            if (relation === 'sibling') {
                return (
                    <g transform="translate(-12,-12) scale(0.9)">
                        <path fill="#fff" d="M5.25 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM2.25 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM18.75 7.5a.75.75 0 0 0-1.5 0v2.25H15a.75.75 0 0 0 0 1.5h2.25v2.25a.75.75 0 0 0 1.5 0v-2.25H21a.75.75 0 0 0 0-1.5h-2.25V7.5Z" />
                    </g>
                );
            }
            if (relation === 'partner' || relation === 'spouse') {
                return (
                    <g transform="translate(-12,-12) scale(0.9)">
                        <path fill="#fff" d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
                    </g>
                );
            }
            if (relation === 'parent' || relation === 'child') {
                return (
                    <g transform="translate(-12,-12) scale(0.9)">
                        <path fill="#fff" fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
                        <path fill="#fff" d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
                    </g>
                );
            }
            return (
                <g transform="translate(-12,-12) scale(0.9)">
                    <circle cx="8" cy="8" r="4" fill="#fff" />
                </g>
            );
        })();

        const handleKey = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate(e);
            }
        };

        return (
            <g className={`ghost-relation-btn ${className} ghost-${direction}`} role="button" tabIndex={0} aria-label={label} onKeyDown={handleKey} onClick={(e) => { e.stopPropagation(); onActivate(e); }}>
                <circle cx={0} cy={0} r={size/2} fill={color} />
                <g transform={`scale(${Math.max(0.9, (size/24))})`}>
                    {icon}
                </g>
            </g>
        );
    }
                        );
                    }
                    return (
                        <g transform="translate(-12,-12) scale(0.9)">
                            <circle cx="8" cy="8" r="4" fill="#fff" />
                        </g>
                    );
                })();

                const handleKey = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onActivate(e);
                    }
                };

                return (
                    <g className={`ghost-relation-btn ${className} ghost-${direction}`} role="button" tabIndex={0} aria-label={label} onKeyDown={handleKey} onClick={(e) => { e.stopPropagation(); onActivate(e); }}>
                        <circle cx={0} cy={0} r={size/2} fill={color} />
                        <g transform={`scale(${Math.max(0.9, (size/24))})`}>
                            {icon}
                        </g>
                    </g>
                );
            }
        </g>

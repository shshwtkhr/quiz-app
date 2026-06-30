import React from 'react';

/**
 * Parses basic Markdown bold (**text**) and italics (*text*) into React elements.
 * Maintains newlines via whitespace-pre-wrap in the parent container.
 */
export const formatMarkdownText = (text: string | undefined) => {
  if (!text) return null;

  // Split by **bold** first
  const boldParts = text.split(/(\*\*.*?\*\*)/g);

  return boldParts.map((boldPart, i) => {
    if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
      return <strong key={`bold-${i}`}>{boldPart.slice(2, -2)}</strong>;
    }
    
    // Split the non-bold parts by *italics*
    const italicParts = boldPart.split(/(\*.*?\*)/g);
    return italicParts.map((italicPart, j) => {
      if (italicPart.startsWith('*') && italicPart.endsWith('*')) {
        return <em key={`italic-${i}-${j}`}>{italicPart.slice(1, -1)}</em>;
      }
      // Return plain text
      return <React.Fragment key={`text-${i}-${j}`}>{italicPart}</React.Fragment>;
    });
  });
};

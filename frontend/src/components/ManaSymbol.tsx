

interface ManaSymbolProps {
  symbol: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ManaSymbol = ({ symbol, size = 'md', className = '' }: ManaSymbolProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const getSymbolStyle = (sym: string) => {
    switch (sym.toLowerCase()) {
      case 'w':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'u':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'b':
        return 'bg-gray-900 text-white border-gray-700';
      case 'r':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'g':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'c':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        // Pour les coûts génériques (nombres)
        return 'bg-gray-200 text-gray-800 border-gray-400';
    }
  };

  return (
    <div
      className={`
        ${sizeClasses[size]} 
        rounded-full border-2 flex items-center justify-center
        text-xs font-bold
        ${getSymbolStyle(symbol)}
        ${className}
      `}
    >
      {symbol}
    </div>
  );
};

interface ManaCostProps {
  manaCost?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ManaCost = ({ manaCost, size = 'md', className = '' }: ManaCostProps) => {
  if (!manaCost) {
    return null;
  }

  // Parse le coût de mana (ex: "{2}{W}{U}")
  const parseManaCost = (cost: string) => {
    const regex = /{([^}]+)}/g;
    const symbols = [];
    let match;
    
    while ((match = regex.exec(cost)) !== null) {
      symbols.push(match[1]);
    }
    
    return symbols;
  };

  const symbols = parseManaCost(manaCost);

  if (symbols.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {symbols.map((sym, index) => (
        <ManaSymbol key={index} symbol={sym} size={size} />
      ))}
    </div>
  );
};

export default ManaSymbol;

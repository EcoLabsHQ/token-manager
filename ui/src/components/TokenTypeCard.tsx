// Icon Components using PNG images
const CeloIconLarge = () => (
  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden">
    <img src="/images/celo.png" alt="Celo" className="w-full h-full object-cover" />
  </div>
);

const EthereumCeloIcon = () => (
  <div className="flex items-end">
    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden -mr-2 relative z-10">
      <img src="/images/ethereum.png" alt="Ethereum" className="w-full h-full object-cover" />
    </div>
    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded overflow-hidden border-2 border-white -ml-1 relative z-20">
      <img src="/images/celo.png" alt="Celo" className="w-full h-full object-cover" />
    </div>
  </div>
);

const CheckCircle = () => (
  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

interface TokenTypeCardProps {
  type: 'celo-native' | 'ethereum-enabled';
  title: string;
  description: string;
  price: string;
  features: string[];
  selected: boolean;
  onSelect: () => void;
}

export function TokenTypeCard({ 
  type, 
  title, 
  description, 
  features, 
  selected, 
  onSelect 
}: TokenTypeCardProps) {
  return (
    <div 
      onClick={onSelect}
      className={`
        bg-white border border-gray-200 flex flex-col p-3 sm:p-4 rounded-xl sm:rounded-2xl w-full 
        transition-all duration-150 cursor-pointer hover:border-gray-300
        ${selected ? 'ring-2 ring-green-500 border-green-500' : ''}
      `}
    >
      <div className="flex flex-col gap-3 sm:gap-4 w-full">
        {/* Header */}
        <div className="flex items-start justify-between w-full">
          {/* Icon */}
          {type === 'celo-native' ? (
            <CeloIconLarge />
          ) : (
            <EthereumCeloIcon />
          )}

          {/* Price and radio */}
          <div className="flex items-start gap-2 sm:gap-3">
            {/* <span className="text-gray-500 text-xs sm:text-sm leading-5">
              {price}
            </span> */}
            {selected ? (
              <CheckCircle />
            ) : (
              <div className="bg-gray-100 rounded-full w-4 h-4 sm:w-5 sm:h-5 shadow-[inset_0.5px_0.5px_2px_0px_rgba(0,0,0,0.25)]" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-0.5 sm:gap-1 w-full">
          <h3 className="font-semibold text-base sm:text-xl text-black tracking-[-0.25px] leading-6 sm:leading-7">
            {title}
          </h3>
          <p className="text-gray-500 text-xs sm:text-base leading-4 sm:leading-5">
            {description}
          </p>
        </div>

        {/* Features */}
        <div className="bg-gray-50 p-1.5 sm:p-2 rounded-md w-full">
          <ul className="text-gray-500 text-xs sm:text-sm leading-5 sm:leading-5.5 list-disc pl-4 sm:pl-5 space-y-0">
            {features.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

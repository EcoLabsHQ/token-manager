// Local image paths
const imgCeloIcon = "/images/celo-icon.svg";
const imgEthereumGroup = "/images/ethereum-celo-group.svg";
const imgCeloSmall = "/images/celo-small.svg";
const imgSelectedCheck = "/images/check-circle.svg";

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
  price, 
  features, 
  selected, 
  onSelect 
}: TokenTypeCardProps) {
  return (
    <div 
      onClick={onSelect}
      className={`
        bg-white border border-gray-200 flex flex-col p-4 rounded-2xl w-full 
        transition-all duration-150 cursor-pointer hover:border-gray-300
        ${selected ? 'ring-2 ring-green-500 border-green-500' : ''}
      `}
    >
      <div className="flex flex-col gap-4 w-full">
        {/* Header */}
        <div className="flex items-start justify-between w-full">
          {/* Icon */}
          {type === 'celo-native' ? (
            <img src={imgCeloIcon} alt="Celo" className="w-10 h-10" />
          ) : (
            <div className="flex items-end pr-2">
              <div className="bg-[#627eea] rounded-md w-10 h-10 flex items-center justify-center -mr-2">
                <img src={imgEthereumGroup} alt="Ethereum" className="w-4 h-6" />
              </div>
              <div className="-mr-2 w-5 h-5 relative">
                <img src={imgCeloSmall} alt="Celo" className="w-6 h-6 absolute -inset-[10%]" />
              </div>
            </div>
          )}

          {/* Price and radio */}
          <div className="flex items-start gap-3">
            <span className="text-gray-500 text-sm leading-5">
              {price}
            </span>
            {selected ? (
              <img src={imgSelectedCheck} alt="Selected" className="w-5 h-5" />
            ) : (
              <div className="bg-gray-100 rounded-full w-5 h-5 shadow-[inset_0.5px_0.5px_2px_0px_rgba(0,0,0,0.25)]" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-1 w-full">
          <h3 className="font-semibold text-xl text-black tracking-[-0.25px] leading-7">
            {title}
          </h3>
          <p className="text-gray-500 text-base leading-5">
            {description}
          </p>
        </div>

        {/* Features */}
        <div className="bg-gray-50 p-2 rounded-md w-full">
          <ul className="text-gray-500 text-sm leading-5.5 list-disc pl-5 space-y-0">
            {features.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

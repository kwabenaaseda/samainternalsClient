/**
 * FilterSelect Component
 * Dropdown filter with clear option
 */

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  label?: string;
  className?: string;
  onClear?: () => void;
  disabled?: boolean;
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder = 'All',
  label,
  className = '',
  onClear,
  disabled = false,
}: FilterSelectProps) {
  const handleChange = (newValue: string) => {
    onChange(newValue);
  };

  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  // Add "All" option at the beginning
  const allOption = { value: '', label: placeholder };
  const displayOptions = [allOption, ...options];

  return (
    <div className={`${className}`}>
      {label && <div className="text-sm font-medium text-gray-700 mb-1">{label}</div>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className="input pr-8 w-full cursor-pointer"
        >
          {displayOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
        {value && (
          <button
            onClick={handleClear}
            className=" absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600"
            type="button"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default FilterSelect;

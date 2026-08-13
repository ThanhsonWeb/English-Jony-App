function Button({
	onClick,
	children,
	className,
	type = "button",
	size = "md",
}) {
	const sizes = {
		sm: "px-3 py-1.5 text-sm",
		md: "px-5 py-2.5 text-xl",
		lg: "px-6 py-3 text-2xl",
	};

	return (
		<button
			onClick={onClick}
			type={type}
			className={`${className} bg-gray-200 hover:bg-gray-100 text-gray-800 rounded-lg font-semibold transition-colors ${sizes[size]} cursor-pointer`}
		>
			{children}
		</button>
	);
}

export default Button;

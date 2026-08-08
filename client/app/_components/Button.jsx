function Button({ onClick, children, type }) {
	return (
		<button
			onClick={onClick}
			type="submit"
			className="bg-gray-200 hover:bg-gray-100 text-gray-800 px-5 py-2.5 rounded-lg font-semibold transition-colors "
		>
			{children}
		</button>
	);
}

export default Button;

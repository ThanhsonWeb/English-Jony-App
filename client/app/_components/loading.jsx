function Loading() {
	return (
		<div className="flex min-h-[70vh] items-center justify-center">
			<div className="relative h-16 w-16">
				<div className="absolute inset-0 rounded-full border-4 border-slate-800" />

				<div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-500 border-r-blue-500" />

				<div className="absolute inset-3 animate-pulse rounded-full bg-blue-500/20 blur-md" />
			</div>
		</div>
	);
}

export default Loading;
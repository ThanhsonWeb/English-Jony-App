import Header from "@/app/_components/Header";

export default function MainLayout({ children }) {
	return (
		<div className="min-h-screen bg-page text-main">
			<Header />
			{children}
		</div>
	);
}

import Header from "@/app/_components/Header";
import MiniDictionary from "@/app/_components/MiniDictionary";

export default function MainLayout({ children }) {
	return (
		<div className="min-h-screen bg-page text-main">
			<Header />
			{children}
			<MiniDictionary />
		</div>
	);
}

import Header from "@/app/_components/Header";

export default function MainLayout({ children }) {
	return (
		<>
			<Header />
			{children}
		</>
	);
}

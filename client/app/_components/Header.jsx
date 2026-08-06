import Logo from "./Logo";
import Navigation from "./Navigation";
import AuthButtons from "./AuthButtons";

function Header() {
	return (
		<header className="relative bg-slate-950 border-b border-slate-800/80 px-4 sm:px-8 py-4 backdrop-blur-md sticky top-0 z-50">
			<div className="flex items-center justify-between max-w-7xl mx-auto">
				<Logo />
				<Navigation />
				<div className="hidden sm:block">
					<AuthButtons />
				</div>
			</div>
		</header>
	);
}

export default Header;

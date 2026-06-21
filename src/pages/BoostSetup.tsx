import { useParams, Link } from "react-router-dom";
import { Zap, Eye, MessagesSquare, Check } from "lucide-react";

export function BoostSetup() {
   const { id } = useParams();

   const packages = [
      { id: "basic", name: "Visibility Boost", price: "$5", days: 1, views: "1k-3k", icon: Eye, color: "text-buildops-green" },
      { id: "pro", name: "Solution Seeker", price: "$15", days: 3, views: "5k-10k", icon: MessagesSquare, popular: true, color: "text-buildops-blue" },
      { id: "max", name: "Bounty Max", price: "$49", days: 7, views: "20k+", icon: Zap, color: "text-buildops-orange" },
   ];

   return (
      <div className="max-w-5xl mx-auto py-12 lg:py-20 px-4 space-y-12">
         <div className="text-center space-y-4 max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-buildops-orange/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(249,115,22,0.15)]">
               <Zap className="text-buildops-orange w-8 h-8 fill-buildops-orange/20" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-buildops-text">Accelerate Discovery</h1>
            <p className="text-buildops-text-secondary text-lg font-medium">Push your post to the top of the feed, bypass algorithms, and attract solutions from senior engineers.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 items-end">
            {packages.map(pkg => (
               <div key={pkg.id} className={`p-8 rounded-3xl border transition-all ${pkg.popular ? 'border-buildops-blue bg-buildops-card shadow-[0_0_40px_rgba(37,99,235,0.1)] scale-100 md:scale-105 z-10' : 'border-buildops-border bg-buildops-bg hover:border-buildops-text-secondary/50'}`}>
                  {pkg.popular && <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-buildops-blue text-white text-xs font-bold rounded-full uppercase tracking-wider backdrop-blur-md">Recommended</span>}
                  
                  <div className={`w-14 h-14 rounded-2xl bg-buildops-bg border border-buildops-border flex items-center justify-center mb-6`}>
                     <pkg.icon className={`w-7 h-7 ${pkg.color}`} />
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-2 text-buildops-text tracking-tight">{pkg.name}</h3>
                  <div className="flex items-baseline gap-1 mb-8 pb-8 border-b border-buildops-border text-buildops-text">
                     <span className="text-4xl font-black">{pkg.price}</span>
                     <span className="text-buildops-text-secondary font-medium">/ package</span>
                  </div>
                  
                  <ul className="space-y-4 mb-10 font-medium">
                     <li className="flex items-start gap-3 text-[15px]"><Check className={`w-5 h-5 shrink-0 ${pkg.color}`} /> <span><strong className="text-buildops-text">{pkg.days} Day</strong> Duration</span></li>
                     <li className="flex items-start gap-3 text-[15px]"><Check className={`w-5 h-5 shrink-0 ${pkg.color}`} /> <span>Est. <strong className="text-buildops-text">{pkg.views}</strong> Views</span></li>
                     <li className="flex items-start gap-3 text-[15px]"><Check className={`w-5 h-5 shrink-0 ${pkg.color}`} /> Featured Feed Tag</li>
                     {pkg.popular && <li className="flex items-start gap-3 text-[15px]"><Check className={`w-5 h-5 shrink-0 ${pkg.color}`} /> Priority in Daily Digest</li>}
                  </ul>
                  
                  <button className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${pkg.popular ? 'bg-buildops-text text-buildops-bg hover:bg-white shadow-lg' : 'bg-buildops-card border border-buildops-border text-buildops-text hover:bg-buildops-bg transition-colors'}`}>
                     Select Package
                  </button>
               </div>
            ))}
         </div>
      </div>
   )
}

"use client"

import { motion } from "motion/react"
import {
    Zap,
    Flame,
    RefreshCw,
    TrendingUp,
    Shield,
    Activity,
    Coins,
    Layers,
    ArrowRight,
    Check,
    Lock,
    Server,
    Wallet,
    LayoutTemplate,
    MousePointerClick,
    ExternalLink,
    Cpu
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { AnimatedGrid } from "@/components/AnimatedGrid"
import Lottie from "@/components/Lottie"

const F402_GREEN = "#26c56a"

const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
}

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
}

export default function F402Page() {
    const scrollToHowItWorks = () => {
        const element = document.getElementById('how-it-works')
        element?.scrollIntoView({ behavior: 'smooth' })
    }

    return (
        <div className="min-h-screen bg-neon-black text-white selection:bg-[#26c56a] selection:text-black font-sans">
            {/* 1. Hero Section */}
            <section className="relative pt-32 pb-20 px-4 overflow-hidden min-h-[80vh] flex items-center">
                <AnimatedGrid color="#26c56a" className="opacity-50" />

                <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={fadeInUp}
                        className="space-y-8 text-center lg:text-left"
                    >
                        <Badge
                            variant="outline"
                            className="border-[#26c56a] text-[#26c56a] px-4 py-1 text-sm uppercase tracking-wider mb-4"
                        >
                            Fuel for Blink402
                        </Badge>

                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
                            F402 <span className="text-[#26c56a]">—</span> <br />
                            Fuel for Blink402
                        </h1>

                        <h2 className="text-2xl md:text-3xl text-gray-300 font-medium max-w-2xl mx-auto lg:mx-0">
                            The micro-fuel that powers every action and strengthens B402.
                        </h2>

                        <p className="text-lg text-gray-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                            Every wallet scan, casino spin, API call, and automation consumes F402 — burning supply and routing value back to B402.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                            <Button
                                size="lg"
                                className="bg-[#26c56a] hover:bg-[#26c56a]/90 text-black font-bold text-lg px-8 h-14 rounded-full w-full sm:w-auto"
                                asChild
                            >
                                <Link href="https://pump.fun/profile/6BMqMyEQpyABpjZHXxKpojuYoqYn9jMD3wnwZ4rANotB?tab=coins" target="_blank">
                                    View Token on Pump.fun
                                    <ExternalLink className="ml-2 h-5 w-5" />
                                </Link>
                            </Button>

                            <Button
                                variant="outline"
                                size="lg"
                                className="border-gray-700 hover:bg-gray-800 text-white h-14 px-8 rounded-full w-full sm:w-auto"
                                onClick={scrollToHowItWorks}
                            >
                                How Fuel Works
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="flex justify-center lg:justify-end"
                    >
                        <div className="relative w-[300px] h-[300px] md:w-[450px] md:h-[450px]">
                            <div className="absolute inset-0 bg-[#26c56a]/5 blur-[100px] rounded-full" />
                            <Lottie
                                src="/lottie/Morphing Pyramid Segments.lottie"
                                autoplay
                                loop
                                width={450}
                                height={450}
                                className="relative z-10 lottie-no-fill"
                            />
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Disclaimer Section */}
            <section className="py-8 px-4 bg-yellow-500/5 border-b border-yellow-500/10">
                <div className="max-w-4xl mx-auto flex gap-4 items-start">
                    <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 shrink-0">
                        <Shield className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-yellow-500 font-bold mb-1">Important Disclaimer</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            F402 is not a new main token. It’s simply the fuel layer for Blink402’s backend actions.
                            B402 remains the primary ecosystem token.
                        </p>
                    </div>
                </div>
            </section>

            {/* 2. "What Is F402?" Section */}
            <section className="py-20 px-4 bg-neon-black/50 border-y border-white/5">
                <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={fadeInUp}
                            className="space-y-6"
                        >
                            <h2 className="text-3xl md:text-4xl font-bold">
                                What Is <span className="text-[#26c56a]">F402</span>?
                            </h2>
                            <p className="text-xl text-gray-300">
                                F402 (Fuel402) is the native fuel layer for the Blink402 ecosystem.
                                It powers on-chain actions such as:
                            </p>

                            <ul className="space-y-4">
                                {[
                                    { icon: Shield, text: "Wallet Health Scans" },
                                    { icon: Coins, text: "Casino Blinks" },
                                    { icon: Server, text: "API Monetization" },
                                    { icon: LayoutTemplate, text: "Templates & Creator Tools" },
                                    { icon: Zap, text: "Action Triggers & Automations" },
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-300">
                                        <div className="p-2 rounded-lg bg-[#26c56a]/10 text-[#26c56a]">
                                            <item.icon className="h-5 w-5" />
                                        </div>
                                        {item.text}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>

                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={fadeInUp}
                            className="bg-gray-900/50 p-8 rounded-2xl border border-white/10"
                        >
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-[#26c56a]/20">
                                    <div>
                                        <h3 className="text-[#26c56a] font-bold text-xl">F402</h3>
                                        <p className="text-sm text-gray-400">Operational Fuel</p>
                                    </div>
                                    <Flame className="h-8 w-8 text-[#26c56a]" />
                                </div>

                                <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-blue-500/20">
                                    <div>
                                        <h3 className="text-blue-400 font-bold text-xl">B402</h3>
                                        <p className="text-sm text-gray-400">Premium Ecosystem Token</p>
                                    </div>
                                    <Shield className="h-8 w-8 text-blue-400" />
                                </div>

                                <p className="text-sm text-gray-400 italic pt-2">
                                    This separation keeps Blink402 scalable, predictable, and able to grow without pushing sell pressure onto B402.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* 3. "Why a Fuel Layer?" Section */}
            <section className="py-20 px-4">
                <div className="max-w-4xl mx-auto text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold mb-6">Why a Fuel Layer?</h2>
                    <p className="text-xl text-gray-300">
                        Blink402 runs thousands of micro-actions per day. Using B402 as fuel would cause:
                    </p>
                </div>

                <div className="max-w-5xl mx-auto grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {[
                        "Constant sell pressure",
                        "Unpredictable costs",
                        "Instability when B402 pumps",
                        "Broken pricing for developers",
                        "Confusing token psychology"
                    ].map((item, i) => (
                        <motion.div
                            key={i}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={fadeInUp}
                            transition={{ delay: i * 0.1 }}
                            className="bg-red-500/5 border border-red-500/20 p-6 rounded-xl text-center"
                        >
                            <div className="mx-auto w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-400">
                                <Lock className="h-5 w-5" />
                            </div>
                            <p className="text-gray-200 font-medium">{item}</p>
                        </motion.div>
                    ))}

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={fadeInUp}
                        transition={{ delay: 0.5 }}
                        className="bg-[#26c56a]/10 border border-[#26c56a]/30 p-6 rounded-xl text-center flex flex-col justify-center"
                    >
                        <p className="text-[#26c56a] font-bold">
                            F402 solves this by handling the micro-transactions, while B402 captures the value.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* 4. "How F402 Works" Section */}
            <section id="how-it-works" className="py-20 px-4 bg-gray-900/30">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">How <span className="text-[#26c56a]">F402</span> Works</h2>
                        <p className="text-gray-400">A simple breakdown of the fuel mechanism</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            {
                                title: "Fuel Consumption",
                                desc: "Each Blink action consumes a small amount of F402.",
                                icon: Zap
                            },
                            {
                                title: "Auto-Burn",
                                desc: "A % of every action is permanently burned.",
                                icon: Flame
                            },
                            {
                                title: "Buybacks for B402",
                                desc: "Part of the fuel spent is used to buy B402 from the open market.",
                                icon: RefreshCw
                            },
                            {
                                title: "Holder Utility",
                                desc: "B402 holders receive daily fuel drip, discounted fuel costs, and boosted rate limits.",
                                icon: Wallet
                            },
                            {
                                title: "Creator Integration",
                                desc: "Creators earn F402 when others use their Blinks, API endpoints, or templates.",
                                icon: LayoutTemplate
                            }
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                variants={fadeInUp}
                                transition={{ delay: i * 0.1 }}
                                className="bg-black/40 border border-white/10 p-8 rounded-2xl hover:border-[#26c56a]/50 transition-colors group"
                            >
                                <div className="w-12 h-12 bg-[#26c56a]/10 rounded-lg flex items-center justify-center mb-6 text-[#26c56a] group-hover:scale-110 transition-transform">
                                    <item.icon className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 5. "Fuel Cost Examples" Section */}
            <section className="py-20 px-4">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">Fuel Cost Examples</h2>

                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                        <div className="grid grid-cols-3 bg-white/5 p-4 font-bold text-gray-300 border-b border-white/10">
                            <div>Action</div>
                            <div>Fuel Cost</div>
                            <div className="hidden sm:block">Notes</div>
                        </div>

                        {[
                            { action: "Wallet Health Scan", cost: "0.5 – 1.5 F402", note: "high volume" },
                            { action: "Casino Spin", cost: "1 – 3 F402", note: "fast burn engine" },
                            { action: "API Monetization (per call)", cost: "0.05 – 0.25 F402", note: "metered usage" },
                            { action: "Template Use", cost: "2 – 8 F402", note: "creator economy" },
                            { action: "Automations", cost: "0.1 – 1.0 F402", note: "recurring triggers" },
                        ].map((row, i) => (
                            <div key={i} className="grid grid-cols-3 p-4 border-b border-white/5 hover:bg-white/5 transition-colors items-center">
                                <div className="font-medium text-white">{row.action}</div>
                                <div className="text-[#26c56a] font-mono">{row.cost}</div>
                                <div className="hidden sm:block text-gray-500 text-sm">{row.note}</div>
                            </div>
                        ))}
                    </div>
                    <p className="text-center text-gray-500 mt-4 text-sm">These amounts are adjustable as the ecosystem grows.</p>
                </div>
            </section>

            {/* 6. "How F402 Supports B402" Section */}
            <section className="py-20 px-4 bg-gradient-to-b from-[#26c56a]/5 to-transparent">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">How F402 Supports B402</h2>
                        <p className="text-xl text-[#26c56a] font-medium">This is the key value loop</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={staggerContainer}
                            className="space-y-6"
                        >
                            {[
                                { title: "Auto-buybacks", desc: "A portion of F402 usage automatically buys back B402." },
                                { title: "B402 holders earn free fuel", desc: "Tiered daily drip based on B402 balance." },
                                { title: "Lower fuel fees for B402 holders", desc: "Encourages accumulation." },
                                { title: "Creator boosts unlock with B402", desc: "B402 stakers earn more F402." },
                                { title: "B402 stays a premium token", desc: "F402 handles utility → B402 captures value." },
                            ].map((item, i) => (
                                <motion.div key={i} variants={fadeInUp} className="flex gap-4">
                                    <div className="mt-1">
                                        <Flame className="h-6 w-6 text-[#26c56a]" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{item.title}</h3>
                                        <p className="text-gray-400">{item.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>

                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={fadeInUp}
                            className="bg-black/60 border border-[#26c56a]/30 p-8 rounded-3xl relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-[#26c56a]/5 blur-3xl" />
                            <div className="relative z-10 text-center space-y-6 py-10">
                                <h3 className="text-2xl font-bold text-white">The Golden Rule</h3>
                                <div className="h-px w-20 bg-[#26c56a] mx-auto" />
                                <p className="text-2xl font-bold leading-relaxed">
                                    <span className="text-[#26c56a]">F402</span> makes Blink402 scale. <br />
                                    <span className="text-blue-400">B402</span> makes Blink402 valuable.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* 7. "Fuel Dashboard" (Coming Soon UI Block) */}
            <section className="py-20 px-4">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">Fuel Dashboard</h2>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: "Your Fuel Balance", value: "--- F402" },
                            { label: "Fuel Burned Today", value: "--- F402" },
                            { label: "Total Fuel Burned", value: "--- F402" },
                            { label: "B402 Tier Boosts", value: "---" },
                        ].map((item, i) => (
                            <Card key={i} className="bg-black/40 border-white/10 relative overflow-hidden">
                                <div className="absolute top-2 right-2">
                                    <Badge variant="secondary" className="bg-white/10 text-xs hover:bg-white/20">Coming Soon</Badge>
                                </div>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-400">{item.label}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-gray-600 animate-pulse">{item.value}</div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* 9. "Why Separate Fuel?" Section */}
            <section className="py-20 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-8">Why Separate Fuel?</h2>
                    <p className="text-xl text-gray-300 mb-12">
                        Because fuel and value shouldn’t come from the same asset.
                    </p>

                    <div className="grid md:grid-cols-2 gap-8 mb-12">
                        <div className="bg-blue-500/10 border border-blue-500/30 p-8 rounded-2xl">
                            <h3 className="text-2xl font-bold text-blue-400 mb-4">B402</h3>
                            <p className="text-lg font-medium mb-2">Meant to be held</p>
                            <p className="text-gray-400 text-sm">Captures value, governance, premium access</p>
                        </div>

                        <div className="bg-[#26c56a]/10 border border-[#26c56a]/30 p-8 rounded-2xl">
                            <h3 className="text-2xl font-bold text-[#26c56a] mb-4">F402</h3>
                            <p className="text-lg font-medium mb-2">Meant to be used</p>
                            <p className="text-gray-400 text-sm">Powers actions, burns supply, high velocity</p>
                        </div>
                    </div>

                    <div className="space-y-2 text-gray-400">
                        <p className="flex items-center justify-center gap-2">
                            <Check className="h-4 w-4 text-[#26c56a]" /> Prevents sell pressure
                        </p>
                        <p className="flex items-center justify-center gap-2">
                            <Check className="h-4 w-4 text-[#26c56a]" /> Keeps action costs stable
                        </p>
                        <p className="flex items-center justify-center gap-2">
                            <Check className="h-4 w-4 text-[#26c56a]" /> Lets B402 pump without breaking the platform
                        </p>
                    </div>

                    <p className="mt-8 text-sm text-gray-500">
                        This is the model used by every major infra project on Solana and beyond.
                    </p>
                </div>
            </section>

            {/* 10. Footer CTA */}
            <section className="py-32 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-[#26c56a]/20 to-transparent pointer-events-none" />

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h2 className="text-4xl md:text-6xl font-bold mb-6">Fuel layer is active.</h2>
                    <p className="text-xl md:text-2xl text-gray-300 mb-12">
                        The fuel mechanism of Blink402 is now operational.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            size="lg"
                            className="bg-[#26c56a] hover:bg-[#26c56a]/90 text-black font-bold text-lg px-8 h-14 rounded-full w-full sm:w-auto"
                        >
                            Get F402 Credits
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            className="border-gray-700 hover:bg-gray-800 text-white h-14 px-8 rounded-full w-full sm:w-auto"
                            asChild
                        >
                            <Link href="https://dexscreener.com/solana/6BMqMyEQpyABpjZHXxKpojuYoqYn9jMD3wnwZ4rANotB" target="_blank">
                                View on DexScreener
                            </Link>
                        </Button>

                        <Button
                            variant="ghost"
                            size="lg"
                            className="text-gray-400 hover:text-white h-14 px-8 rounded-full w-full sm:w-auto"
                            asChild
                        >
                            <Link href="/">
                                Learn More About B402
                            </Link>
                        </Button>
                    </div>
                </div>
            </section >
        </div >
    )
}

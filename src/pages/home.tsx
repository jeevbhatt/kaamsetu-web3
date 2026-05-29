import { useUIStore } from "../store";
import {
  provinces,
  jobCategories,
  provinceVisualsById,
} from "@shram-sewa/shared/constants";
import { Button, Card, CardContent, Badge } from "../components/ui";
import { Link } from "@tanstack/react-router";
import {
  Search,
  MapPin,
  Users,
  Star,
  ArrowRight,
  ShieldCheck,
  Timer,
  Landmark,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import { AdaptiveImage } from "../components/AdaptiveImage";
import { royaltyFreeImages } from "../lib/royalty-free-images";
import { motion, useReducedMotion } from "framer-motion";
import {
  useWorkerCount,
  useJobCategoryCounts,
} from "../hooks/useWorkers";

// Format helper that gracefully degrades to a dash while the live count
// is loading (or to the fallback if Supabase is offline).
function fmtCount(value: number | undefined, fallback: string): string {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return value.toLocaleString("en-IN");
}

export default function HomePage() {
  const { locale } = useUIStore();
  const isNepali = locale === "ne";
  const reduceMotion = useReducedMotion();

  // Live counts — replaces the hardcoded "7 / 77 / 753 / 12" with real
  // numbers from the database. The hooks degrade gracefully to undefined
  // when Supabase is unconfigured, so we fall back to the geography
  // constants we already know (provinces.length, districts count) rather
  // than rendering "—" forever in offline/static preview mode.
  const workerCount = useWorkerCount();
  const jobCategoryCounts = useJobCategoryCounts();
  const liveWorkers = workerCount.data?.total;
  const liveAvailable = workerCount.data?.available;
  const liveJobCount = jobCategoryCounts.data?.length;

  return (
    <div className="space-y-10 md:space-y-4">
      <section className="flex justify-end -mt-2">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Badge
            variant="outline"
            className="inline-flex items-center gap-1.5 border-crimson-200 bg-crimson-50 text-crimson-800 shadow-sm"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {isNepali ? "सरकारी मान्यता प्राप्त" : "Government Recognized"}
          </Badge>
        </motion.div>
      </section>

      {/* Hero Section
          Mobile: break out of the page wrapper's px-4 with -mx-4 so the
          hero is edge-to-edge (no awkward gap framing the card on small
          screens). Soften the corner radius to rounded-3xl on mobile so
          the bleed reads as "page header" not "floating card".
          Desktop (sm+): restore mx-0 and the original rounded-[2rem]
          inset-card look. */}
      <section className="relative overflow-hidden -mx-4 sm:mx-0 rounded-3xl sm:rounded-[2rem] border border-mountain-700/20 bg-hero-mesh px-5 py-7 md:px-10 md:py-12 text-white">
        <div className="absolute inset-0 opacity-30">
          <AdaptiveImage
            image={royaltyFreeImages.hero}
            locale={locale}
            priority
            className="h-full w-full"
            imgClassName="h-full w-full object-cover"
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-mountain-900/75 via-mountain-900/45 to-transparent" />

        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-start">
          <div>
            <Badge
              variant="gold"
              className="mb-4 border-gold-200/80 bg-gold-300/85 text-mountain-900 shadow-sm"
            >
              {isNepali
                ? "७५३ स्थानीय तहमा पहुँच"
                : "Access in 753 Local Units"}
            </Badge>

            <motion.h1
              className="font-display text-4xl md:text-5xl lg:text-6xl leading-tight mb-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            >
              {isNepali ? "श्रम सेवा" : "Shram Sewa"}
            </motion.h1>

            <p className="text-base md:text-xl text-terrain-100 max-w-2xl leading-relaxed mb-7">
              {isNepali
                ? "नेपालको स्थानीय सरकार-केंद्रित जनशक्ति प्लेटफर्म। आफ्नो स्थान, वडाको आवश्यकता र कामको प्रकार अनुसार भरपर्दो कामदार खोज्नुहोस्।"
                : "Nepal's local government-focused manpower platform. Discover reliable workers based on your location, ward needs, and job type."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link to="/search" preload="intent">
                <Button
                  size="xl"
                  className="gap-2 rounded-full w-full sm:w-auto"
                >
                  <Search className="w-5 h-5" />
                  {isNepali ? "कामदार खोज्नुहोस्" : "Find Workers"}
                </Button>
              </Link>
              <Link to="/login" preload="intent">
                <Button
                  variant="outline"
                  size="xl"
                  className="rounded-full w-full sm:w-auto bg-white/10 border-white/40 text-white hover:bg-white/15 hover:text-white"
                >
                  {isNepali ? "कामदार दर्ता गर्नुहोस्" : "Register as Worker"}
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-terrain-100/90">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 border border-white/20">
                <ShieldCheck className="w-4 h-4" />
                {isNepali ? "विश्वसनीय प्लेटफर्म" : "Trusted platform"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 border border-white/20">
                <Timer className="w-4 h-4" />
                {isNepali
                  ? "छिटो खोज, छिटो निर्णय"
                  : "Fast discovery, faster hiring"}
              </span>
              {typeof liveAvailable === "number" && liveAvailable > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 border border-emerald-300/40 text-emerald-100">
                  <CheckCircle2 className="w-4 h-4" />
                  {isNepali
                    ? `अहिले ${fmtCount(liveAvailable, "0")} कामदार उपलब्ध`
                    : `${fmtCount(liveAvailable, "0")} workers available now`}
                </span>
              )}
            </div>
          </div>

          <motion.div
            className="glass-panel animate-soft-float rounded-3xl p-5 md:p-6"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          >
            <h2 className="font-display text-xl md:text-2xl text-mountain-900 mb-4">
              {isNepali ? "क्षेत्रीय पहुँच" : "Regional Reach"}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-terrain-200 bg-white/90 p-4">
                <div className="text-2xl font-bold text-crimson-700">7</div>
                <p className="text-sm text-terrain-500">
                  {isNepali ? "प्रदेश" : "Provinces"}
                </p>
              </div>
              <div className="rounded-2xl border border-terrain-200 bg-white/90 p-4">
                <div className="text-2xl font-bold text-crimson-700">77</div>
                <p className="text-sm text-terrain-500">
                  {isNepali ? "जिल्ला" : "Districts"}
                </p>
              </div>
              <div className="rounded-2xl border border-terrain-200 bg-white/90 p-4 col-span-2">
                <div className="text-3xl font-bold text-gold-700">753</div>
                <p className="text-sm text-terrain-500">
                  {isNepali ? "स्थानीय तह कभरेज" : "Local unit coverage"}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-terrain-500 leading-relaxed">
              {isNepali
                ? "तस्बिर स्रोत: Wikimedia Commons"
                : "Image source: Wikimedia Commons"}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats — coverage geography is static (we know it), worker counts
          and job categories pull live from Supabase so the bar tells the
          truth about adoption rather than aspirational round numbers. */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 content-auto">
        {[
          {
            icon: Users,
            label: isNepali ? "दर्ता कामदार" : "Registered Workers",
            value: fmtCount(liveWorkers, "—"),
            highlight: true,
          },
          {
            icon: MapPin,
            label: isNepali ? "जिल्लाहरू" : "Districts",
            value: "77",
            highlight: false,
          },
          {
            icon: Landmark,
            label: isNepali ? "स्थानीय तह" : "Local Units",
            value: "753",
            highlight: false,
          },
          {
            icon: Star,
            label: isNepali ? "कार्य वर्ग" : "Job Types",
            value: fmtCount(liveJobCount, String(jobCategories.length)),
            highlight: false,
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{
              duration: 0.22,
              delay: index * 0.04,
              ease: [0.2, 0, 0, 1],
            }}
            whileHover={reduceMotion ? undefined : { y: -3 }}
          >
            <Card
              className={`hover:shadow-card-hover transition-shadow duration-200 ${
                stat.highlight
                  ? "border-crimson-200 bg-gradient-to-br from-crimson-50/60 to-white"
                  : ""
              }`}
            >
              <CardContent className="p-6 text-center">
                <stat.icon
                  className={`w-8 h-8 mx-auto mb-2 ${
                    stat.highlight ? "text-crimson-800" : "text-crimson-700"
                  }`}
                />
                <div
                  className={`text-3xl font-bold ${
                    stat.highlight ? "text-crimson-900" : "text-mountain-900"
                  }`}
                >
                  {stat.value}
                </div>
                <div className="text-sm text-terrain-500">{stat.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>

      {/* Visual Context */}
      <section className="grid lg:grid-cols-2 gap-5 content-auto items-stretch">
        <motion.div whileHover={reduceMotion ? undefined : { y: -3 }}>
          <Card className="overflow-hidden border-terrain-200 h-full flex flex-col">
            <div className="h-56 sm:h-60 md:h-64 w-full">
              <AdaptiveImage
                image={royaltyFreeImages.communityWork}
                locale={locale}
                className="h-full w-full"
                imgClassName="h-full w-full object-cover"
              />
            </div>
            <CardContent className="p-5 flex-1">
              <h3 className="font-display text-xl text-mountain-900 mb-2">
                {isNepali
                  ? "स्थानीय काम, स्थानीय विश्वास"
                  : "Local work, local trust"}
              </h3>
              <p className="text-sm text-terrain-500 leading-relaxed">
                {isNepali
                  ? "कामदार प्रोफाइल, स्थान र उपलब्धता आधारमा छानोट गर्दा निर्णय प्रक्रिया स्पष्ट र भरपर्दो हुन्छ।"
                  : "Profile-driven discovery with location and availability helps make clearer, more reliable hiring decisions."}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={reduceMotion ? undefined : { y: -3 }}>
          <Card className="overflow-hidden border-terrain-200 h-full flex flex-col">
            <div className="h-56 sm:h-60 md:h-64 w-full">
              <AdaptiveImage
                image={royaltyFreeImages.himalayanContext}
                locale={locale}
                className="h-full w-full"
                imgClassName="h-full w-full object-cover"
              />
            </div>
            <CardContent className="p-5 flex-1">
              <h3 className="font-display text-xl text-mountain-900 mb-2">
                {isNepali
                  ? "हिमाली सन्दर्भसँग मिलेको डिजाईन"
                  : "Designed for Himalayan realities"}
              </h3>
              <p className="text-sm text-terrain-500 leading-relaxed">
                {isNepali
                  ? "कम नेटवर्क र मोबाइल-प्राथमिक प्रयोगलाई ध्यानमा राखेर छिटो लोड हुने, स्पष्ट र पढ्न सजिलो अनुभव।"
                  : "Built for low-connectivity and mobile-first usage with fast-loading, readable, and practical UI patterns."}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Provinces */}
      <section className="content-auto">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-mountain-900 mb-6 flex items-center gap-2">
          <Landmark className="w-6 h-6 text-crimson-700" />
          {isNepali ? "प्रदेश अनुसार खोज्नुहोस्" : "Search by Province"}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {provinces.map((province, index) => {
            const visual = provinceVisualsById[province.id];

            return (
              <motion.div
                key={province.id}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{
                  duration: 0.24,
                  delay: index * 0.03,
                  ease: "easeOut",
                }}
                whileHover={reduceMotion ? undefined : { y: -3 }}
                whileTap={reduceMotion ? undefined : { scale: 0.99 }}
              >
                <Link
                  to="/search"
                  preload="intent"
                  search={{ provinceId: province.id }}
                  className="group block h-full"
                >
                  <Card className="relative h-full overflow-hidden rounded-[1.5rem] border border-terrain-200/70 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-lg hover:shadow-crimson-900/10 hover:border-crimson-200/70">
                    <div
                      className="absolute inset-0 scale-[1.04] bg-cover bg-center opacity-45 transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform group-hover:scale-[1.08]"
                      style={{
                        backgroundImage: `url(${visual?.imageUrlSmall ?? royaltyFreeImages.himalayanContext.landscape.src})`,
                      }}
                      aria-hidden="true"
                    />

                    <div
                      className="absolute inset-0 transition-opacity duration-200 bg-gradient-to-b from-white/82 via-white/68 to-white/95 group-hover:opacity-80"
                      aria-hidden="true"
                    />

                    <CardContent className="relative p-5 h-full min-h-[160px] flex flex-col items-center justify-center backdrop-blur-[2px] transition-[backdrop-filter,background-color] duration-200 group-hover:backdrop-blur-none">
                      <motion.div
                        className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white font-bold text-lg shadow-inner ring-1 ring-white/20 transition-[border-radius,transform] duration-200 group-hover:rounded-[1rem] group-hover:-translate-y-0.5"
                        style={{ backgroundColor: province.colorHex }}
                      >
                        {province.id}
                      </motion.div>
                      <div className="text-base font-bold text-mountain-900 transition-colors duration-300 group-hover:text-crimson-800">
                        {isNepali ? province.nameNp : province.nameEn}
                      </div>
                      <div className="mt-1.5 px-3 py-1 bg-white/55 backdrop-blur-md rounded-full text-xs font-medium text-terrain-700 transition-colors duration-200 group-hover:bg-white/85 group-hover:text-crimson-900">
                        {isNepali
                          ? (visual?.majorCityNp ?? "मुख्य शहर")
                          : (visual?.majorCityEn ?? "Major city")}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Job Categories */}
      <section className="content-auto">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-mountain-900 mb-6">
          {isNepali ? "कार्य वर्गहरू" : "Job Categories"}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {jobCategories.map((job, index) => (
            <motion.div
              key={job.slug}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
              whileHover={reduceMotion ? undefined : { y: -2 }}
            >
              <Link
                to="/search"
                preload="intent"
                search={{ jobCategory: job.slug }}
                className="group"
              >
                <Card className="h-full transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-md hover:border-crimson-200">
                  <CardContent className="p-4 flex items-center gap-3">
                    <span className="text-3xl">{job.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-mountain-900 group-hover:text-crimson-700 truncate">
                        {isNepali ? job.nameNp : job.nameEn}
                      </div>
                      <div className="text-xs text-terrain-500 truncate">
                        {job.description}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-terrain-500 group-hover:text-crimson-700 transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Most hired spotlight */}
      <section className="content-auto">
        <Card className="border-terrain-200 bg-gradient-to-br from-terrain-50 via-white to-gold-50/50">
          <CardContent className="p-6 md:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <Badge variant="gold" className="inline-flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                {isNepali ? "शीर्ष भाडा" : "Top Hires"}
              </Badge>
              <h3 className="text-2xl md:text-3xl font-display font-bold text-mountain-900">
                {isNepali
                  ? "सबैभन्दा धेरै भाडामा लिइएका कामदारहरू"
                  : "Most hired workers this season"}
              </h3>
              <p className="text-terrain-600 max-w-2xl">
                {isNepali
                  ? "स्थानीय सरकारले विश्वास गरेको, पटक पटक भाडामा लिइएका कामदारहरूको सूची हेरेर सुरक्षित निर्णय गर्नुहोस्।"
                  : "Explore trusted workers with the strongest hire history across local governments."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <Link to="/most-hired" preload="intent" className="w-full sm:w-auto">
                <Button size="lg" className="rounded-full w-full">
                  {isNepali ? "शीर्ष कामदार हेर्नुहोस्" : "View top workers"}
                </Button>
              </Link>
              <Link to="/search" preload="intent" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full w-full"
                >
                  {isNepali ? "सबै कामदार खोज्नुहोस्" : "Browse all workers"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="glass-panel rounded-3xl p-6 md:p-8 border border-terrain-200 content-auto"
      >
        <h2 className="text-2xl md:text-3xl font-display font-bold text-mountain-900 mb-8 text-center">
          {isNepali ? "कसरी काम गर्छ?" : "How It Works"}
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: isNepali ? "खोज्नुहोस्" : "Search",
              desc: isNepali
                ? "आफ्नो स्थान र आवश्यक कार्य वर्ग चयन गर्नुहोस्"
                : "Select your location and required job category",
            },
            {
              step: "2",
              title: isNepali ? "छान्नुहोस्" : "Choose",
              desc: isNepali
                ? "उपलब्ध कामदारहरू हेर्नुहोस् र उपयुक्त छान्नुहोस्"
                : "Browse available workers and pick the right one",
            },
            {
              step: "3",
              title: isNepali ? "भाडामा लिनुहोस्" : "Hire",
              desc: isNepali
                ? "एक क्लिकमा कामदारलाई भाडामा लिनुहोस्"
                : "Hire the worker with one click",
            },
          ].map((item, index) => (
            <motion.div
              key={item.step}
              className="text-center"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.22, delay: index * 0.05 }}
              whileHover={reduceMotion ? undefined : { y: -3 }}
            >
              <div className="w-12 h-12 rounded-full bg-crimson-100 text-crimson-700 font-bold text-xl flex items-center justify-center mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="font-semibold text-mountain-900 mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-terrain-500">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

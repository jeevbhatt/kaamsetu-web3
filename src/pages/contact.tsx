import { useUIStore } from "../store";
import { Card, CardContent } from "../components/ui";
import { Mail, Phone, MapPin } from "lucide-react";

export default function ContactPage() {
  const { locale } = useUIStore();
  const isNepali = locale === "ne";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl md:text-3xl font-display font-bold text-mountain-900">
        {isNepali ? "सम्पर्क" : "Contact"}
      </h1>

      <Card>
        <CardContent className="p-5 space-y-4 text-sm">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 mt-0.5 text-crimson-700" />
            <div>
              <p className="font-medium text-mountain-900">
                {isNepali ? "कार्यालय" : "Office"}
              </p>
              <p className="text-terrain-500">
                {isNepali ? "काठमाडौं, नेपाल" : "Kathmandu, Nepal"}
              </p>
            </div>
          </div>

          {/* Phone hidden by default — was previously rendering the
              placeholder "+977 1-XXXXXXX" to every visitor. Set
              PUBLIC_SUPPORT_PHONE to enable. */}
          {import.meta.env.PUBLIC_SUPPORT_PHONE && (
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 mt-0.5 text-crimson-700" />
              <div>
                <p className="font-medium text-mountain-900">
                  {isNepali ? "फोन" : "Phone"}
                </p>
                <a
                  className="text-terrain-500 hover:text-crimson-700"
                  href={`tel:${import.meta.env.PUBLIC_SUPPORT_PHONE}`}
                >
                  {import.meta.env.PUBLIC_SUPPORT_PHONE}
                </a>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 mt-0.5 text-crimson-700" />
            <div>
              <p className="font-medium text-mountain-900">
                {isNepali ? "इमेल" : "Email"}
              </p>
              <a
                className="text-terrain-500 hover:text-crimson-700"
                href={`mailto:${import.meta.env.PUBLIC_SUPPORT_EMAIL ?? "info@shramsewa.gov.np"}`}
              >
                {import.meta.env.PUBLIC_SUPPORT_EMAIL ??
                  "info@shramsewa.gov.np"}
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

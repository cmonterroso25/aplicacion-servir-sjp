import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data, error } = await supabase
  .from("sectores")
  .select("*")
  .order("nombre");

if (error) {
  console.error("Error:", error);
  process.exit(1);
} else {
  console.log(`Total sectores: ${data.length}\n`);
  data.forEach((sector) => {
    console.log(`- ${sector.nombre} (ID: ${sector.id})`);
    if (sector.encargado_nombre) {
      console.log(`  Encargado: ${sector.encargado_nombre}`);
    }
  });
}

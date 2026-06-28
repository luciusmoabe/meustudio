import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log('Fixing orphaned leads...');
  
  // Get all leads
  const { data: leads } = await supabase.from('leads_propostas').select('id, fotografo_id, pacote_id, etapa_pipeline_id');
  
  // Get all stages
  const { data: etapas } = await supabase.from('etapas_pipeline').select('id, fotografo_id, pacote_id, ordem');
  
  let fixedCount = 0;
  for (const lead of leads) {
    const stage = etapas.find(e => e.id === lead.etapa_pipeline_id);
    // If the stage is missing or belongs to another fotografo
    if (!stage || stage.fotografo_id !== lead.fotografo_id) {
      // Find the correct stage
      let correctStage = etapas.find(e => e.fotografo_id === lead.fotografo_id && e.pacote_id === lead.pacote_id && e.ordem === 1);
      if (!correctStage) {
        // Fallback to standard funnel
        correctStage = etapas.find(e => e.fotografo_id === lead.fotografo_id && e.pacote_id === null && e.ordem === 1);
      }
      
      if (correctStage) {
        await supabase.from('leads_propostas').update({ etapa_pipeline_id: correctStage.id }).eq('id', lead.id);
        fixedCount++;
        console.log(`Fixed lead ${lead.id} -> stage ${correctStage.id}`);
      } else {
        console.log(`Could not find a valid stage for lead ${lead.id} (fotografo: ${lead.fotografo_id})`);
      }
    }
  }
  
  console.log(`Fixed ${fixedCount} leads.`);
}
run();

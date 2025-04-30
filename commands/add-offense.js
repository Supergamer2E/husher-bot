// add-offense.js
import { loadOffenseLog, saveOffenseLog, addOffenseToLog } from '../helpers/offenseLog.js';

export default async function (interaction, context) {
  const { userTimeouts } = context;
  const target = interaction.options.getUser('target');
  const count = interaction.options.getInteger('count');
  const corrector = interaction.options.getUser('corrector');

  if (!userTimeouts[target.id]) userTimeouts[target.id] = 0;
  userTimeouts[target.id] += count;

  for (let i = 0; i < count; i++) {
    addOffenseToLog(target.id, 'Manually added offense', corrector?.id || null);
  }

  await interaction.reply({
    content: `✅ Added ${count} offense(s) to ${target.tag}.`,
    ephemeral: true
  });
}


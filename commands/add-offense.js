import { logOffense } from '../helpers/offenseLogger.js';

export default async function(interaction, { userTimeouts }) {
  const target = interaction.options.getUser('target');
  const count = interaction.options.getInteger('count');
  const reason = interaction.options.getString('reason');
  const corrector = interaction.options.getUser('corrector');

  if (!userTimeouts[target.id]) userTimeouts[target.id] = 0;
  userTimeouts[target.id] += count;

  for (let i = 0; i < count; i++) {
    logOffense(target.id, {
      timestamp: Date.now(),
      reason,
      correctorId: corrector?.id || null
    });
  }

  await interaction.reply({ content: `✅ Added ${count} offense(s) to ${target.tag}.\n📝 Reason: ${reason}`, ephemeral: true });
}


// File: commands/add-offense.js
import { logOffense } from '../helpers/offenseLogger.js';
import { EmbedBuilder } from 'discord.js';

export default async function (interaction, { userTimeouts }) {
  const target = interaction.options.getUser('target');
  const count = interaction.options.getInteger('count');
  const corrector = interaction.options.getUser('corrector');
  const guild = interaction.guild;

  if (!userTimeouts[target.id]) userTimeouts[target.id] = 0;
  userTimeouts[target.id] += count;

  const reason = `Manually added offense${count > 1 ? 's' : ''}`;

  // Log and announce each offense
  const channel = guild.channels.cache.find(c => c.name === 'husher-announcements');
  for (let i = 0; i < count; i++) {
    const entry = {
      timestamp: Date.now(),
      reason,
      correctorId: corrector?.id || null
    };
    logOffense(target.id, entry);

    // Build and send announcement for each offense
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('📕 New Offense Recorded')
        .setDescription(
          `**User:** <@${target.id}>\n` +
          `**Reason:** ${entry.reason}\n` +
          (entry.correctorId ? `**Corrected by:** <@${entry.correctorId}>\n` : '') +
          `**Timestamp:** <t:${Math.floor(entry.timestamp / 1000)}:R>`
        )
        .setColor('Red')
        .setTimestamp();
      await channel.send({ embeds: [embed] });
    }
  }

  await interaction.reply({ content: `✅ Added ${count} offense(s) to ${target.tag}.`, ephemeral: true });
}

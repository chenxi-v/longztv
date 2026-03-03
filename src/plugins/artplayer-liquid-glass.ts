import Artplayer from 'artplayer'

export default function artplayerPluginLiquidGlass(_option = {}) {
  return (art: Artplayer) => {
    const { constructor } = art
    // @ts-ignore
    const { addClass, append, createElement } = constructor.utils
    const { $bottom, $progress, $controls, $player } = art.template

    const $liquidGlass = createElement('div')
    addClass($player, 'artplayer-plugin-liquid-glass')
    addClass($liquidGlass, 'art-liquid-glass')

    append($bottom, $liquidGlass)
    append($liquidGlass, $progress)
    append($liquidGlass, $controls)

    return {
      name: 'artplayerPluginLiquidGlass',
    }
  }
}

if (typeof window !== 'undefined') {
  (window as any).artplayerPluginLiquidGlass = artplayerPluginLiquidGlass
}

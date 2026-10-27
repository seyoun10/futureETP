import { render, screen } from '@testing-library/react-native';
import { CommodityListScreen } from './CommodityListScreen';

describe('CommodityListScreen', () => {
  it('렌더링된다', async () => {
    await render(<CommodityListScreen />);
    expect(screen.root).toBeOnTheScreen();
  });
});

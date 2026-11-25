import os

from seleniumbase import BaseCase

from test.end2end.helpers.helper import Helper

path_to_this_test_file_folder = os.path.dirname(os.path.abspath(__file__))

closer = '//*[@data-testid="closer"]'


class Test(BaseCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = Helper(self)

        #   A TABLE or GRID row that is taller than a page and cannot be
        #   scaled down, because it has an explicit height.
        #   Before the fix, the paginator re-evaluated the row forever:
        #   the TABLE hung the browser tab, the GRID threw
        #   "[grid.split] loop guard triggered".
        #   Now the row stays in place and overflows its page.
        #   The tests check that the render finishes with all content in
        #   order; they do not fix the page placement of the tall row.

    def test_table_last_row(self):
        self.helper.open_case(path_to_this_test_file_folder, 'table_last_row')
        self.helper.assert_html2pdf4doc_success()
        self.helper.assert_elements_order('//*[@data-testid="row-1"]', '//*[@data-testid="row-2"]')
        self.helper.assert_elements_order('//*[@data-testid="row-2"]', closer)

    def test_table_first_row(self):
        self.helper.open_case(path_to_this_test_file_folder, 'table_first_row')
        self.helper.assert_html2pdf4doc_success()
        self.helper.assert_elements_order('//*[@data-testid="row-1"]', '//*[@data-testid="row-2"]')
        self.helper.assert_elements_order('//*[@data-testid="row-2"]', closer)

    def test_grid_row(self):
        self.helper.open_case(path_to_this_test_file_folder, 'grid_row')
        self.helper.assert_html2pdf4doc_success()
        self.helper.assert_element_on_the_page('//*[@data-testid="cell-a"]', 1)
        self.helper.assert_elements_order('//*[@data-testid="cell-c"]', closer)
